import * as vscode from 'vscode';
import { RiteMarkEditorProvider } from './ritemarkEditor';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    RiteMarkEditorProvider.register(context)
  );
}

export function deactivate() {}
