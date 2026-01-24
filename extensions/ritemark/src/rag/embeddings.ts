/**
 * OpenAI Embeddings client for RAG pipeline.
 * Uses text-embedding-3-small model via the same API key as the AI assistant.
 */

import OpenAI from 'openai';
import { getAPIKeyManager } from '../ai/apiKeyManager';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_BATCH_SIZE = 100; // OpenAI allows up to 2048, but 100 is practical

export interface EmbeddingResult {
	embedding: Float32Array;
	tokenCount: number;
}

/**
 * Get an OpenAI client instance using the stored API key.
 */
async function getClient(): Promise<OpenAI> {
	const keyManager = getAPIKeyManager();
	const apiKey = await keyManager.getAPIKey();

	if (!apiKey) {
		throw new Error('OpenAI API key not configured. Use "RiteMark: Configure API Key" command.');
	}

	return new OpenAI({ apiKey });
}

/**
 * Generate embedding for a single text.
 */
export async function embedText(text: string): Promise<EmbeddingResult> {
	const results = await embedTexts([text]);
	return results[0];
}

/**
 * Generate embeddings for multiple texts (batched).
 * More efficient than calling one by one.
 */
export async function embedTexts(texts: string[]): Promise<EmbeddingResult[]> {
	if (texts.length === 0) {
		return [];
	}

	const client = await getClient();
	const results: EmbeddingResult[] = [];

	// Process in batches
	for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
		const batch = texts.slice(i, i + MAX_BATCH_SIZE);

		const response = await client.embeddings.create({
			model: EMBEDDING_MODEL,
			input: batch,
			dimensions: EMBEDDING_DIMENSIONS,
		});

		for (const item of response.data) {
			const embedding = new Float32Array(item.embedding);
			results.push({
				embedding,
				tokenCount: response.usage.total_tokens,
			});
		}
	}

	return results;
}

/**
 * Get the embedding dimensions for the configured model.
 */
export function getEmbeddingDimensions(): number {
	return EMBEDDING_DIMENSIONS;
}

/**
 * Convert Float32Array to Buffer for SQLite storage.
 */
export function embeddingToBuffer(embedding: Float32Array): Buffer {
	return Buffer.from(embedding.buffer);
}

/**
 * Convert Buffer from SQLite back to Float32Array.
 */
export function bufferToEmbedding(buffer: Buffer): Float32Array {
	return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}
