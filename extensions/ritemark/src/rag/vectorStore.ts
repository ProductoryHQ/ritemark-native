/**
 * Vector store using sqlite-vec for local semantic search.
 * Uses better-sqlite3 as the SQLite driver with sqlite-vec extension.
 */

import * as path from 'path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { getEmbeddingDimensions, embeddingToBuffer, bufferToEmbedding } from './embeddings';

export interface StoredChunk {
	id: number;
	content: string;
	source: string;
	page: number | null;
	section: string | null;
	chunkIndex: number;
	embedding: Float32Array;
	createdAt: string;
}

export interface SearchResult {
	content: string;
	source: string;
	page: number | null;
	section: string | null;
	score: number;
}

export class VectorStore {
	private db: Database.Database;
	private dimensions: number;

	constructor(dbPath: string) {
		this.dimensions = getEmbeddingDimensions();
		this.db = new Database(dbPath);

		// Load sqlite-vec extension
		sqliteVec.load(this.db);

		this.initSchema();
	}

	private initSchema(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS chunks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				content TEXT NOT NULL,
				source TEXT NOT NULL,
				page INTEGER,
				section TEXT,
				chunk_index INTEGER NOT NULL,
				file_hash TEXT,
				created_at TEXT DEFAULT (datetime('now'))
			);

			CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);
			CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(file_hash);
		`);

		// Create virtual table for vector search
		this.db.exec(`
			CREATE VIRTUAL TABLE IF NOT EXISTS chunk_embeddings USING vec0(
				chunk_id INTEGER PRIMARY KEY,
				embedding float[${this.dimensions}]
			);
		`);
	}

	/**
	 * Insert a chunk with its embedding into the store.
	 */
	insertChunk(
		content: string,
		source: string,
		embedding: Float32Array,
		metadata: {
			page?: number | null;
			section?: string | null;
			chunkIndex: number;
			fileHash?: string;
		}
	): number {
		const insertChunk = this.db.prepare(`
			INSERT INTO chunks (content, source, page, section, chunk_index, file_hash)
			VALUES (?, ?, ?, ?, ?, ?)
		`);

		const insertEmbedding = this.db.prepare(`
			INSERT INTO chunk_embeddings (chunk_id, embedding)
			VALUES (?, ?)
		`);

		const result = insertChunk.run(
			content,
			source,
			metadata.page ?? null,
			metadata.section ?? null,
			metadata.chunkIndex,
			metadata.fileHash ?? null
		);

		const chunkId = result.lastInsertRowid as number;
		insertEmbedding.run(chunkId, embeddingToBuffer(embedding));

		return chunkId;
	}

	/**
	 * Insert multiple chunks in a transaction (much faster).
	 */
	insertChunks(
		chunks: Array<{
			content: string;
			source: string;
			embedding: Float32Array;
			page?: number | null;
			section?: string | null;
			chunkIndex: number;
			fileHash?: string;
		}>
	): number[] {
		const ids: number[] = [];

		const insertChunk = this.db.prepare(`
			INSERT INTO chunks (content, source, page, section, chunk_index, file_hash)
			VALUES (?, ?, ?, ?, ?, ?)
		`);

		const insertEmbedding = this.db.prepare(`
			INSERT INTO chunk_embeddings (chunk_id, embedding)
			VALUES (?, ?)
		`);

		const transaction = this.db.transaction(() => {
			for (const chunk of chunks) {
				const result = insertChunk.run(
					chunk.content,
					chunk.source,
					chunk.page ?? null,
					chunk.section ?? null,
					chunk.chunkIndex,
					chunk.fileHash ?? null
				);
				const chunkId = result.lastInsertRowid as number;
				insertEmbedding.run(chunkId, embeddingToBuffer(chunk.embedding));
				ids.push(chunkId);
			}
		});

		transaction();
		return ids;
	}

	/**
	 * Semantic search: find top-K most similar chunks to query embedding.
	 */
	search(queryEmbedding: Float32Array, topK: number = 5, sourceFilter?: string): SearchResult[] {
		let query: string;
		let params: any[];

		if (sourceFilter) {
			query = `
				SELECT c.content, c.source, c.page, c.section, ce.distance
				FROM chunk_embeddings ce
				JOIN chunks c ON c.id = ce.chunk_id
				WHERE ce.embedding MATCH ?
				AND c.source LIKE ?
				ORDER BY ce.distance
				LIMIT ?
			`;
			params = [embeddingToBuffer(queryEmbedding), `%${sourceFilter}%`, topK];
		} else {
			query = `
				SELECT c.content, c.source, c.page, c.section, ce.distance
				FROM chunk_embeddings ce
				JOIN chunks c ON c.id = ce.chunk_id
				WHERE ce.embedding MATCH ?
				ORDER BY ce.distance
				LIMIT ?
			`;
			params = [embeddingToBuffer(queryEmbedding), topK];
		}

		const stmt = this.db.prepare(query);
		const rows = stmt.all(...params) as Array<{
			content: string;
			source: string;
			page: number | null;
			section: string | null;
			distance: number;
		}>;

		return rows.map(row => ({
			content: row.content,
			source: row.source,
			page: row.page,
			section: row.section,
			// Convert distance to similarity score (1 - normalized_distance)
			score: 1 - row.distance,
		}));
	}

	/**
	 * Remove all chunks for a specific source file.
	 */
	removeBySource(source: string): number {
		const chunks = this.db.prepare('SELECT id FROM chunks WHERE source = ?').all(source) as Array<{ id: number }>;

		if (chunks.length === 0) {
			return 0;
		}

		const chunkIds = chunks.map(c => c.id);
		const placeholders = chunkIds.map(() => '?').join(',');

		this.db.prepare(`DELETE FROM chunk_embeddings WHERE chunk_id IN (${placeholders})`).run(...chunkIds);
		const result = this.db.prepare('DELETE FROM chunks WHERE source = ?').run(source);

		return result.changes;
	}

	/**
	 * Check if a file is already indexed (by hash).
	 */
	isFileIndexed(fileHash: string): boolean {
		const row = this.db.prepare('SELECT 1 FROM chunks WHERE file_hash = ? LIMIT 1').get(fileHash) as any;
		return !!row;
	}

	/**
	 * Get statistics about the vector store.
	 */
	getStats(): { totalChunks: number; totalSources: number; sources: Array<{ source: string; chunks: number }> } {
		const totalChunks = (this.db.prepare('SELECT COUNT(*) as count FROM chunks').get() as any).count;
		const sources = this.db.prepare(
			'SELECT source, COUNT(*) as chunks FROM chunks GROUP BY source ORDER BY chunks DESC'
		).all() as Array<{ source: string; chunks: number }>;

		return {
			totalChunks,
			totalSources: sources.length,
			sources,
		};
	}

	/**
	 * Close the database connection.
	 */
	close(): void {
		this.db.close();
	}
}

/**
 * Get the default database path for a workspace.
 */
export function getDefaultDbPath(workspacePath: string): string {
	return path.join(workspacePath, '.ritemark', 'rag.db');
}
