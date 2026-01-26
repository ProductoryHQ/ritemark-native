/**
 * Document indexer - orchestrates the RAG pipeline.
 *
 * Watches workspace for markdown files, chunks the text,
 * generates embeddings via OpenAI, and stores in Orama.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { chunkText, TextChunk } from './chunker';
import { embedTexts } from './embeddings';
import { VectorStore, getDefaultDbPath } from './vectorStore';

/** Supported file extensions for indexing (markdown only) */
const SUPPORTED_EXTENSIONS = ['.md', '.markdown'];

export interface IndexerOptions {
	workspacePath: string;
}

export interface IndexProgress {
	total: number;
	processed: number;
	current: string;
	errors: string[];
}

export class DocumentIndexer {
	private store: VectorStore;
	private workspacePath: string;
	private watcher: vscode.FileSystemWatcher | null = null;
	private indexing = false;
	private cancelRequested = false;
	private initialized = false;

	private _onProgress = new vscode.EventEmitter<IndexProgress>();
	public readonly onProgress = this._onProgress.event;

	constructor(options: IndexerOptions) {
		this.workspacePath = options.workspacePath;

		// Ensure .ritemark directory exists
		const ritemarkDir = path.join(this.workspacePath, '.ritemark');
		if (!fs.existsSync(ritemarkDir)) {
			fs.mkdirSync(ritemarkDir, { recursive: true });
		}

		const dbPath = getDefaultDbPath(this.workspacePath);
		this.store = new VectorStore(dbPath);
	}

	/**
	 * Initialize the indexer (must be called before use).
	 */
	async init(): Promise<void> {
		if (this.initialized) {
			return;
		}
		await this.store.init();
		this.initialized = true;
	}

	private ensureInit(): void {
		if (!this.initialized) {
			throw new Error('DocumentIndexer not initialized. Call init() first.');
		}
	}

	/**
	 * Start watching for file changes in the workspace.
	 */
	startWatching(): void {
		const pattern = `**/*{${SUPPORTED_EXTENSIONS.join(',')}}`;
		this.watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(this.workspacePath, pattern)
		);

		this.watcher.onDidCreate(uri => this.indexFile(uri.fsPath).catch(console.error));
		this.watcher.onDidChange(uri => this.reindexFile(uri.fsPath).catch(console.error));
		this.watcher.onDidDelete(uri => this.removeFile(uri.fsPath).catch(console.error));
	}

	/**
	 * Stop watching for file changes.
	 */
	stopWatching(): void {
		this.watcher?.dispose();
		this.watcher = null;
	}

	/**
	 * Cancel indexing in progress.
	 */
	cancelIndexing(): void {
		if (this.indexing) {
			this.cancelRequested = true;
		}
	}

	/**
	 * Index all supported files in the workspace.
	 */
	async indexAll(): Promise<IndexProgress> {
		this.ensureInit();

		if (this.indexing) {
			throw new Error('Indexing already in progress');
		}

		this.indexing = true;
		this.cancelRequested = false;
		const files = this.findSupportedFiles();

		const progress: IndexProgress = {
			total: files.length,
			processed: 0,
			current: '',
			errors: [],
		};

		try {
			for (const file of files) {
				if (this.cancelRequested) {
					break;
				}

				progress.current = path.basename(file);
				this._onProgress.fire({ ...progress });

				try {
					const hash = this.getFileHash(file);
					if (await this.store.isFileIndexed(hash)) {
						progress.processed++;
						continue;
					}

					await this.indexFile(file);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					progress.errors.push(`${path.basename(file)}: ${msg}`);
				}

				progress.processed++;
				this._onProgress.fire({ ...progress });
			}

			// Save index to disk after indexing
			await this.store.save();
		} finally {
			this.indexing = false;
			this.cancelRequested = false;
			progress.current = '';
			this._onProgress.fire({ ...progress });
		}

		return progress;
	}

	/**
	 * Index a single markdown file.
	 */
	async indexFile(filePath: string): Promise<void> {
		const ext = path.extname(filePath).toLowerCase();
		if (!SUPPORTED_EXTENSIONS.includes(ext)) {
			return;
		}

		// Read markdown content
		let content = fs.readFileSync(filePath, 'utf-8');
		if (!content.trim()) {
			return;
		}

		// Remove base64 embedded images (they break chunking and aren't useful for search)
		// Matches: ![alt](data:image/...;base64,...) and ![](data:image/...;base64,...)
		content = content.replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, '[image]');

		// Chunk the text
		const chunks: TextChunk[] = chunkText(content, filePath);

		if (chunks.length === 0) {
			return;
		}

		// Generate embeddings (batched)
		const texts = chunks.map(c => c.content);
		const embeddings = await embedTexts(texts);

		// Store in vector DB
		const fileHash = this.getFileHash(filePath);
		const storeChunks = chunks.map((chunk, i) => ({
			content: chunk.content,
			source: filePath,
			embedding: embeddings[i].embedding,
			page: chunk.metadata.page,
			section: chunk.metadata.section,
			chunkIndex: chunk.metadata.chunkIndex,
			fileHash,
		}));

		await this.store.insertChunks(storeChunks);
	}

	/**
	 * Re-index a file (remove old chunks, then index fresh).
	 */
	async reindexFile(filePath: string): Promise<void> {
		await this.store.removeBySource(filePath);
		await this.indexFile(filePath);
		await this.store.save();
	}

	/**
	 * Remove a file from the index.
	 */
	async removeFile(filePath: string): Promise<void> {
		await this.store.removeBySource(filePath);
		await this.store.save();
	}

	/**
	 * Get the vector store instance (for search operations).
	 */
	getStore(): VectorStore {
		return this.store;
	}

	/**
	 * Get indexing statistics.
	 */
	async getStats() {
		return this.store.getStats();
	}

	/**
	 * Find all supported files in the workspace.
	 */
	private findSupportedFiles(): string[] {
		const files: string[] = [];
		this.walkDirectory(this.workspacePath, files);
		return files;
	}

	private walkDirectory(dir: string, files: string[]): void {
		const entries = fs.readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			// Skip hidden directories and node_modules
			if (entry.name.startsWith('.') || entry.name === 'node_modules') {
				continue;
			}

			if (entry.isDirectory()) {
				this.walkDirectory(fullPath, files);
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name).toLowerCase();
				if (SUPPORTED_EXTENSIONS.includes(ext)) {
					files.push(fullPath);
				}
			}
		}
	}

	/**
	 * Calculate file hash for change detection.
	 */
	private getFileHash(filePath: string): string {
		const stat = fs.statSync(filePath);
		const content = `${filePath}:${stat.size}:${stat.mtimeMs}`;
		return crypto.createHash('md5').update(content).digest('hex');
	}

	/**
	 * Dispose all resources.
	 */
	async dispose(): Promise<void> {
		this.stopWatching();
		await this.store.close();
		this._onProgress.dispose();
	}
}
