/**
 * Vector store using Orama for local semantic search.
 * Pure TypeScript, zero native dependencies.
 *
 * Supports:
 * - Vector search (semantic similarity)
 * - Full-text search (BM25 keyword matching)
 * - Hybrid search (combines both with RRF - when rag-v2-enhancements flag enabled)
 */

import * as path from 'path';
import * as fs from 'fs';
import {
	create,
	insert,
	remove,
	search,
	count,
	save,
	load,
} from '@orama/orama';
import type { Orama, Results } from '@orama/orama';
import { getEmbeddingDimensions } from './embeddings';
import { isEnabled } from '../features';

// Schema definition for Orama
const SCHEMA = {
	id: 'string',
	content: 'string',
	source: 'string',
	sourceType: 'string', // Document type: 'markdown', 'pdf', 'docx'
	page: 'number',
	section: 'string',
	chunkIndex: 'number',
	fileHash: 'string',
	createdAt: 'string',
	embedding: 'vector[1536]', // OpenAI text-embedding-3-small dimensions
} as const;

type OramaDB = Orama<typeof SCHEMA>;

// Document type matching schema
interface ChunkDocument {
	id: string;
	content: string;
	source: string;
	sourceType: string;
	page: number;
	section: string;
	chunkIndex: number;
	fileHash: string;
	createdAt: string;
	embedding: number[];
}

export interface StoredChunk {
	id: string;
	content: string;
	source: string;
	page: number | null;
	section: string | null;
	chunkIndex: number;
	embedding: number[];
	createdAt: string;
}

export interface SearchResult {
	content: string;
	source: string;
	page: number | null;
	section: string | null;
	score: number;
	/** Document type for re-ranking (pdf, markdown, docx) */
	sourceType?: string;
	/** Index timestamp for recency scoring */
	createdAt?: string;
}

export class VectorStore {
	private db: OramaDB | null = null;
	private dbPath: string;
	private dimensions: number;
	private idCounter: number = 0;
	private dirty: boolean = false;

	constructor(dbPath: string) {
		this.dimensions = getEmbeddingDimensions();
		this.dbPath = dbPath;
	}

	/**
	 * Initialize the database (async - must be called before use).
	 */
	async init(): Promise<void> {
		// Ensure directory exists
		const dir = path.dirname(this.dbPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		// Try to load existing index
		if (fs.existsSync(this.dbPath)) {
			try {
				const data = fs.readFileSync(this.dbPath, 'utf-8');
				const snapshot = JSON.parse(data);
				this.db = await create({ schema: SCHEMA });
				await load(this.db, snapshot);

				await count(this.db); // Verify loaded successfully
			} catch (err) {
				console.warn('[VectorStore] Failed to load existing index, creating new:', err);
				await this.createNewDb();
			}
		} else {
			await this.createNewDb();
		}
	}

	private async createNewDb(): Promise<void> {
		this.db = await create({
			schema: SCHEMA,
		});
	}

	private ensureInit(): OramaDB {
		if (!this.db) {
			throw new Error('VectorStore not initialized. Call init() first.');
		}
		return this.db;
	}

	private generateId(): string {
		return `chunk_${Date.now()}_${++this.idCounter}`;
	}

	/**
	 * Insert a chunk with its embedding into the store.
	 */
	async insertChunk(
		content: string,
		source: string,
		embedding: Float32Array | number[],
		metadata: {
			page?: number | null;
			section?: string | null;
			chunkIndex: number;
			fileHash?: string;
			sourceType?: string;
		}
	): Promise<string> {
		const db = this.ensureInit();
		const id = this.generateId();

		await insert(db, {
			id,
			content,
			source,
			sourceType: metadata.sourceType ?? 'markdown',
			page: metadata.page ?? 0,
			section: metadata.section ?? '',
			chunkIndex: metadata.chunkIndex,
			fileHash: metadata.fileHash ?? '',
			createdAt: new Date().toISOString(),
			embedding: Array.from(embedding),
		});

		this.dirty = true;
		return id;
	}

	/**
	 * Insert multiple chunks (faster than individual inserts).
	 */
	async insertChunks(
		chunks: Array<{
			content: string;
			source: string;
			embedding: Float32Array | number[];
			page?: number | null;
			section?: string | null;
			chunkIndex: number;
			fileHash?: string;
			sourceType?: string;
		}>
	): Promise<string[]> {
		const db = this.ensureInit();
		const ids: string[] = [];

		for (const chunk of chunks) {
			const id = this.generateId();
			await insert(db, {
				id,
				content: chunk.content,
				source: chunk.source,
				sourceType: chunk.sourceType ?? 'markdown',
				page: chunk.page ?? 0,
				section: chunk.section ?? '',
				chunkIndex: chunk.chunkIndex,
				fileHash: chunk.fileHash ?? '',
				createdAt: new Date().toISOString(),
				embedding: Array.from(chunk.embedding),
			});
			ids.push(id);
		}

		this.dirty = true;
		return ids;
	}

	/**
	 * Search for documents using vector similarity.
	 * When rag-v2-enhancements flag is enabled, uses hybrid search (vector + BM25).
	 *
	 * @param queryEmbedding - The query embedding vector
	 * @param topK - Maximum number of results to return
	 * @param _sourceFilter - Optional filter by source path (not yet implemented)
	 * @param queryText - The original query text (required for hybrid search)
	 */
	async search(
		queryEmbedding: Float32Array | number[],
		topK: number = 5,
		_sourceFilter?: string,
		queryText?: string
	): Promise<SearchResult[]> {
		const db = this.ensureInit();
		const useHybrid = isEnabled('rag-v2-enhancements') && queryText;

		let results: Results<ChunkDocument>;

		if (useHybrid) {
			// Hybrid search: combines vector + BM25 with RRF (Reciprocal Rank Fusion)
			results = await search(db, {
				mode: 'hybrid',
				term: queryText,
				vector: {
					value: Array.from(queryEmbedding),
					property: 'embedding',
				},
				similarity: 0.3,
				limit: topK,
			}) as Results<ChunkDocument>;
		} else {
			// Vector-only search (Sprint 24 behavior)
			results = await search(db, {
				mode: 'vector',
				vector: {
					value: Array.from(queryEmbedding),
					property: 'embedding',
				},
				similarity: 0.3,
				limit: topK,
			}) as Results<ChunkDocument>;
		}

		return results.hits.map((hit) => ({
			content: hit.document.content,
			source: hit.document.source,
			page: hit.document.page === 0 ? null : hit.document.page,
			section: hit.document.section === '' ? null : hit.document.section,
			score: hit.score,
			sourceType: hit.document.sourceType,
			createdAt: hit.document.createdAt,
		}));
	}

	/**
	 * Hybrid search combining vector similarity and BM25 keyword matching.
	 * Uses Reciprocal Rank Fusion (RRF) to combine results.
	 *
	 * @param queryEmbedding - The query embedding vector
	 * @param queryText - The query text for keyword matching
	 * @param topK - Maximum number of results to return
	 */
	async searchHybrid(
		queryEmbedding: Float32Array | number[],
		queryText: string,
		topK: number = 10
	): Promise<SearchResult[]> {
		const db = this.ensureInit();

		const results = await search(db, {
			mode: 'hybrid',
			term: queryText,
			vector: {
				value: Array.from(queryEmbedding),
				property: 'embedding',
			},
			similarity: 0.3,
			limit: topK,
		}) as Results<ChunkDocument>;

		return results.hits.map((hit) => ({
			content: hit.document.content,
			source: hit.document.source,
			page: hit.document.page === 0 ? null : hit.document.page,
			section: hit.document.section === '' ? null : hit.document.section,
			score: hit.score,
			sourceType: hit.document.sourceType,
			createdAt: hit.document.createdAt,
		}));
	}

	/**
	 * Full-text search only (BM25 keyword matching).
	 */
	async searchText(
		queryText: string,
		topK: number = 5,
		_sourceFilter?: string
	): Promise<SearchResult[]> {
		const db = this.ensureInit();

		const results = await search(db, {
			term: queryText,
			limit: topK,
		}) as Results<ChunkDocument>;

		return results.hits.map((hit) => ({
			content: hit.document.content,
			source: hit.document.source,
			page: hit.document.page === 0 ? null : hit.document.page,
			section: hit.document.section === '' ? null : hit.document.section,
			score: hit.score,
			sourceType: hit.document.sourceType,
			createdAt: hit.document.createdAt,
		}));
	}

	/**
	 * Remove all chunks for a specific source file.
	 */
	async removeBySource(source: string): Promise<number> {
		const db = this.ensureInit();

		// Find all documents with this source using fulltext search on source
		const results = await search(db, {
			term: '',
			limit: 10000,
		}) as Results<ChunkDocument>;

		// Filter to matching source and remove
		let removed = 0;
		for (const hit of results.hits) {
			if (hit.document.source === source) {
				await remove(db, hit.id);
				removed++;
			}
		}

		if (removed > 0) {
			this.dirty = true;
		}
		return removed;
	}

	/**
	 * Check if a file is already indexed (by hash).
	 */
	async isFileIndexed(fileHash: string): Promise<boolean> {
		const db = this.ensureInit();

		// Search for any document with this hash
		const results = await search(db, {
			term: '',
			limit: 10000,
		}) as Results<ChunkDocument>;

		return results.hits.some(hit => hit.document.fileHash === fileHash);
	}

	/**
	 * Check if a file is indexed by source path.
	 */
	async isSourceIndexed(source: string): Promise<boolean> {
		const db = this.ensureInit();

		const results = await search(db, {
			term: '',
			limit: 10000,
		}) as Results<ChunkDocument>;

		return results.hits.some(hit => hit.document.source === source);
	}

	/**
	 * Get statistics about the vector store.
	 */
	async getStats(): Promise<{
		totalChunks: number;
		totalSources: number;
		sources: Array<{ source: string; chunks: number }>;
	}> {
		const db = this.ensureInit();

		const totalChunks = await count(db);

		// Get all documents to count by source
		const results = await search(db, {
			term: '',
			limit: 100000,
		}) as Results<ChunkDocument>;

		// Group by source
		const sourceMap = new Map<string, number>();
		for (const hit of results.hits) {
			const source = hit.document.source;
			sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
		}

		const sources = Array.from(sourceMap.entries())
			.map(([source, chunks]) => ({ source, chunks }))
			.sort((a, b) => b.chunks - a.chunks);

		return {
			totalChunks,
			totalSources: sources.length,
			sources,
		};
	}

	/**
	 * Persist the index to disk.
	 */
	async save(): Promise<void> {
		if (!this.dirty) {
			return;
		}

		const db = this.ensureInit();
		const snapshot = await save(db);
		fs.writeFileSync(this.dbPath, JSON.stringify(snapshot));
		this.dirty = false;
	}

	/**
	 * Close the database (saves to disk).
	 */
	async close(): Promise<void> {
		await this.save();
		this.db = null;
	}
}

/**
 * Get the default database path for a workspace.
 */
export function getDefaultDbPath(workspacePath: string): string {
	return path.join(workspacePath, '.ritemark', 'rag-index.json');
}
