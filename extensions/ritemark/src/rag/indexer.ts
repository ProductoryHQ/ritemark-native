/**
 * Document indexer - orchestrates the RAG pipeline.
 *
 * Watches workspace for supported files, parses them via Docling (Python subprocess),
 * chunks the text, generates embeddings via OpenAI, and stores in sqlite-vec.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { chunkSections, chunkText, TextChunk } from './chunker';
import { embedTexts } from './embeddings';
import { VectorStore, getDefaultDbPath } from './vectorStore';

/** Supported file extensions for indexing */
const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.htm', '.png', '.jpg', '.jpeg'];

/** Parsed document structure from Python parser */
interface ParsedDocument {
	source: string;
	format: string;
	full_text: string;
	sections: Array<{
		content: string;
		page?: number | null;
		title?: string | null;
		level?: number | null;
	}>;
	tables: Array<{
		content: string;
		page?: number | null;
	}>;
	metadata: {
		title: string;
		page_count: number;
	};
}

export interface IndexerOptions {
	workspacePath: string;
	/** Path to uv binary (defaults to 'uv' in PATH) */
	uvPath?: string;
	/** Max concurrent file processing */
	concurrency?: number;
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
	private uvPath: string;
	private ragServerPath: string;
	private watcher: vscode.FileSystemWatcher | null = null;
	private indexing = false;

	private _onProgress = new vscode.EventEmitter<IndexProgress>();
	public readonly onProgress = this._onProgress.event;

	constructor(options: IndexerOptions) {
		this.workspacePath = options.workspacePath;
		this.uvPath = options.uvPath || 'uv';

		// rag-server is at repo root level
		this.ragServerPath = path.resolve(__dirname, '..', '..', '..', '..', 'rag-server');

		// Ensure .ritemark directory exists
		const ritemarkDir = path.join(this.workspacePath, '.ritemark');
		if (!fs.existsSync(ritemarkDir)) {
			fs.mkdirSync(ritemarkDir, { recursive: true });
		}

		const dbPath = getDefaultDbPath(this.workspacePath);
		this.store = new VectorStore(dbPath);
	}

	/**
	 * Start watching for file changes in the workspace.
	 */
	startWatching(): void {
		const pattern = `**/*{${SUPPORTED_EXTENSIONS.join(',')}}`;
		this.watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(this.workspacePath, pattern)
		);

		this.watcher.onDidCreate(uri => this.indexFile(uri.fsPath));
		this.watcher.onDidChange(uri => this.reindexFile(uri.fsPath));
		this.watcher.onDidDelete(uri => this.removeFile(uri.fsPath));
	}

	/**
	 * Stop watching for file changes.
	 */
	stopWatching(): void {
		this.watcher?.dispose();
		this.watcher = null;
	}

	/**
	 * Index all supported files in the workspace.
	 */
	async indexAll(): Promise<IndexProgress> {
		if (this.indexing) {
			throw new Error('Indexing already in progress');
		}

		this.indexing = true;
		const files = this.findSupportedFiles();
		const progress: IndexProgress = {
			total: files.length,
			processed: 0,
			current: '',
			errors: [],
		};

		try {
			for (const file of files) {
				progress.current = path.basename(file);
				this._onProgress.fire({ ...progress });

				try {
					const hash = this.getFileHash(file);
					if (this.store.isFileIndexed(hash)) {
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
		} finally {
			this.indexing = false;
			progress.current = '';
			this._onProgress.fire({ ...progress });
		}

		return progress;
	}

	/**
	 * Index a single file.
	 */
	async indexFile(filePath: string): Promise<void> {
		const ext = path.extname(filePath).toLowerCase();
		if (!SUPPORTED_EXTENSIONS.includes(ext)) {
			return;
		}

		// Parse document via Python/Docling
		const parsed = await this.parseDocument(filePath);

		// Chunk the text
		let chunks: TextChunk[];
		if (parsed.sections.length > 0) {
			chunks = chunkSections(parsed.sections, filePath);
		} else {
			chunks = chunkText(parsed.full_text, filePath);
		}

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

		this.store.insertChunks(storeChunks);
	}

	/**
	 * Re-index a file (remove old chunks, then index fresh).
	 */
	async reindexFile(filePath: string): Promise<void> {
		this.store.removeBySource(filePath);
		await this.indexFile(filePath);
	}

	/**
	 * Remove a file from the index.
	 */
	removeFile(filePath: string): void {
		this.store.removeBySource(filePath);
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
	getStats() {
		return this.store.getStats();
	}

	/**
	 * Parse a document using the Python Docling parser via uv.
	 */
	private parseDocument(filePath: string): Promise<ParsedDocument> {
		return new Promise((resolve, reject) => {
			const proc = spawn(this.uvPath, [
				'run',
				'--project', this.ragServerPath,
				'python', '-m', 'ritemark_rag.parser', filePath
			], {
				cwd: this.ragServerPath,
				env: { ...process.env },
			});

			let stdout = '';
			let stderr = '';

			proc.stdout.on('data', (data: Buffer) => {
				stdout += data.toString();
			});

			proc.stderr.on('data', (data: Buffer) => {
				stderr += data.toString();
			});

			proc.on('close', (code) => {
				if (code !== 0) {
					reject(new Error(`Parser failed (exit ${code}): ${stderr}`));
					return;
				}

				try {
					const parsed = JSON.parse(stdout) as ParsedDocument;
					resolve(parsed);
				} catch (e) {
					reject(new Error(`Failed to parse output: ${e}`));
				}
			});

			proc.on('error', (err) => {
				reject(new Error(`Failed to spawn parser: ${err.message}. Is 'uv' installed?`));
			});
		});
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
	dispose(): void {
		this.stopWatching();
		this.store.close();
		this._onProgress.dispose();
	}
}
