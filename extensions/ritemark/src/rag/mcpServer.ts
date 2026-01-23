/**
 * MCP Server manager - spawns and manages the Python FastMCP server
 * for external AI agent access (Claude Code, Codex, Cursor).
 *
 * Transport: stdio (subprocess spawned by extension).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChildProcess, spawn } from 'child_process';

export interface MCPServerOptions {
	workspacePath: string;
	/** Path to uv binary (defaults to 'uv' in PATH) */
	uvPath?: string;
}

export class MCPServerManager {
	private process: ChildProcess | null = null;
	private workspacePath: string;
	private uvPath: string;
	private ragServerPath: string;
	private _isRunning = false;

	private _onStatusChange = new vscode.EventEmitter<boolean>();
	public readonly onStatusChange = this._onStatusChange.event;

	constructor(options: MCPServerOptions) {
		this.workspacePath = options.workspacePath;
		this.uvPath = options.uvPath || 'uv';
		this.ragServerPath = path.resolve(__dirname, '..', '..', '..', '..', 'rag-server');
	}

	get isRunning(): boolean {
		return this._isRunning;
	}

	/**
	 * Start the MCP server as a subprocess.
	 */
	start(): void {
		if (this.process) {
			return; // Already running
		}

		try {
			this.process = spawn(this.uvPath, [
				'run',
				'--project', this.ragServerPath,
				'python', '-m', 'ritemark_rag.server'
			], {
				cwd: this.workspacePath,
				env: {
					...process.env,
					RITEMARK_WORKSPACE: this.workspacePath,
				},
				stdio: ['pipe', 'pipe', 'pipe'],
			});

			this._isRunning = true;
			this._onStatusChange.fire(true);

			this.process.stderr?.on('data', (data: Buffer) => {
				const msg = data.toString().trim();
				if (msg) {
					console.log(`[MCP Server] ${msg}`);
				}
			});

			this.process.on('close', (code) => {
				console.log(`[MCP Server] Process exited with code ${code}`);
				this.process = null;
				this._isRunning = false;
				this._onStatusChange.fire(false);
			});

			this.process.on('error', (err) => {
				console.error(`[MCP Server] Failed to start: ${err.message}`);
				this.process = null;
				this._isRunning = false;
				this._onStatusChange.fire(false);
			});

		} catch (err) {
			console.error('[MCP Server] Spawn failed:', err);
			this._isRunning = false;
		}
	}

	/**
	 * Stop the MCP server.
	 */
	stop(): void {
		if (this.process) {
			this.process.kill('SIGTERM');
			this.process = null;
			this._isRunning = false;
			this._onStatusChange.fire(false);
		}
	}

	/**
	 * Generate MCP configuration for Claude Code.
	 * Writes to .claude/settings.json in the workspace.
	 */
	generateClaudeConfig(): void {
		const claudeDir = path.join(this.workspacePath, '.claude');
		const settingsPath = path.join(claudeDir, 'settings.json');

		// Read existing settings or create new
		let settings: Record<string, any> = {};
		if (fs.existsSync(settingsPath)) {
			try {
				settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
			} catch {
				// Ignore parse errors, overwrite
			}
		} else {
			if (!fs.existsSync(claudeDir)) {
				fs.mkdirSync(claudeDir, { recursive: true });
			}
		}

		// Add/update MCP server config
		if (!settings.mcpServers) {
			settings.mcpServers = {};
		}

		settings.mcpServers['ritemark-rag'] = {
			command: this.uvPath,
			args: [
				'run',
				'--project', this.ragServerPath,
				'python', '-m', 'ritemark_rag.server'
			],
			cwd: this.workspacePath,
			env: {
				RITEMARK_WORKSPACE: this.workspacePath
			}
		};

		fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
		vscode.window.showInformationMessage(
			'MCP config written to .claude/settings.json. Claude Code can now search your documents.'
		);
	}

	/**
	 * Check if MCP config already exists for this workspace.
	 */
	hasMCPConfig(): boolean {
		const settingsPath = path.join(this.workspacePath, '.claude', 'settings.json');
		if (!fs.existsSync(settingsPath)) {
			return false;
		}
		try {
			const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
			return !!settings.mcpServers?.['ritemark-rag'];
		} catch {
			return false;
		}
	}

	dispose(): void {
		this.stop();
		this._onStatusChange.dispose();
	}
}
