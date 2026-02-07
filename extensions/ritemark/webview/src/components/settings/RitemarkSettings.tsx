/**
 * Ritemark Settings Component
 *
 * Branded settings page for API keys and feature configuration.
 */

import { useState, useEffect } from 'react';
import {
  Key,
  Zap,
  RefreshCw,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Bot,
} from 'lucide-react';
import { vscode } from '../../lib/vscode';
import { getDefaultAssistantModel } from '../../config/modelConfig';

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  api: 'responses' | 'chat';
}

interface SettingsData {
  voiceDictation: boolean;
  ritemarkFlows: boolean;
  updatesEnabled: boolean;
  aiModel: string;
  availableModels: ModelInfo[];
  openaiKey: string;
  openaiKeyConfigured: boolean;
  googleKey: string;
  googleKeyConfigured: boolean;
}

interface TestResult {
  key: 'openai' | 'google';
  success: boolean;
  error?: string;
  message?: string;
}

export function RitemarkSettings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [openaiKey, setOpenaiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [testingOpenai, setTestingOpenai] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'settings':
          setSettings(message.data);
          // Don't overwrite user input if they're typing
          if (!openaiKey && message.data.openaiKey) {
            setOpenaiKey(message.data.openaiKey);
          }
          if (!googleKey && message.data.googleKey) {
            setGoogleKey(message.data.googleKey);
          }
          break;

        case 'testResult':
          setTestResults((prev) => ({ ...prev, [message.key]: message }));
          if (message.key === 'openai') setTestingOpenai(false);
          if (message.key === 'google') setTestingGoogle(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleToggle = (key: string, value: boolean) => {
    vscode.postMessage({ type: 'setSetting', key, value });
  };

  const handleSettingChange = (key: string, value: string | boolean | number) => {
    vscode.postMessage({ type: 'setSetting', key, value });
  };

  const handleSaveApiKey = (keyName: string, value: string) => {
    vscode.postMessage({ type: 'setApiKey', key: keyName, value });
    // Clear test result when key changes
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[keyName === 'openai-api-key' ? 'openai' : 'google'];
      return next;
    });
  };

  const handleTestApiKey = (keyName: string) => {
    if (keyName === 'openai-api-key') {
      setTestingOpenai(true);
    } else {
      setTestingGoogle(true);
    }
    vscode.postMessage({ type: 'testApiKey', key: keyName });
  };

  if (!settings) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--vscode-descriptionForeground)]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--vscode-foreground)] mb-2">
          Ritemark Settings
        </h1>
        <p className="text-sm text-[var(--vscode-descriptionForeground)]">
          Configure API keys and features for Ritemark AI.
        </p>
      </div>

      {/* API Keys Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-[var(--vscode-foreground)]" />
          <h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
            API Keys
          </h2>
        </div>

        {/* OpenAI */}
        <div className="mb-6 p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--vscode-foreground)]">
              OpenAI API Key
            </label>
            {settings.openaiKeyConfigured && (
              <span className="flex items-center gap-1 text-xs text-[var(--vscode-testing-iconPassed)]">
                <Check size={12} />
                Configured
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <input
                type={showOpenaiKey ? 'text' : 'password'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-10 text-sm rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
              />
              <button
                onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
              >
                {showOpenaiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              onClick={() => handleSaveApiKey('openai-api-key', openaiKey)}
              className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
            >
              Save
            </button>
            <button
              onClick={() => handleTestApiKey('openai-api-key')}
              disabled={!settings.openaiKeyConfigured || testingOpenai}
              className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50"
            >
              {testingOpenai ? <Loader2 size={16} className="animate-spin" /> : 'Test'}
            </button>
          </div>

          {testResults.openai && (
            <div
              className={`text-xs p-2 rounded ${
                testResults.openai.success
                  ? 'bg-[var(--vscode-testing-iconPassed)]/10 text-[var(--vscode-testing-iconPassed)]'
                  : 'bg-[var(--vscode-testing-iconFailed)]/10 text-[var(--vscode-testing-iconFailed)]'
              }`}
            >
              {testResults.openai.success ? (
                <span className="flex items-center gap-1">
                  <Check size={12} /> API key is valid
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <X size={12} /> {testResults.openai.error}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
            Used for: AI Chat, Flows (LLM), Image Generation (GPT Image 1.5)
            <a
              href="https://platform.openai.com/api-keys"
              className="ml-2 inline-flex items-center gap-1 text-[var(--vscode-textLink-foreground)] hover:underline"
            >
              Get API key <ExternalLink size={10} />
            </a>
          </p>
        </div>

        {/* Google AI */}
        <div className="p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--vscode-foreground)]">
              Google AI API Key
              <span className="ml-2 text-xs text-[var(--vscode-descriptionForeground)]">(optional)</span>
            </label>
            {settings.googleKeyConfigured && (
              <span className="flex items-center gap-1 text-xs text-[var(--vscode-testing-iconPassed)]">
                <Check size={12} />
                Configured
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <input
                type={showGoogleKey ? 'text' : 'password'}
                value={googleKey}
                onChange={(e) => setGoogleKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-3 py-2 pr-10 text-sm rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
              />
              <button
                onClick={() => setShowGoogleKey(!showGoogleKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
              >
                {showGoogleKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              onClick={() => handleSaveApiKey('google-ai-key', googleKey)}
              className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
            >
              Save
            </button>
            <button
              onClick={() => handleTestApiKey('google-ai-key')}
              disabled={!settings.googleKeyConfigured || testingGoogle}
              className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50"
            >
              {testingGoogle ? <Loader2 size={16} className="animate-spin" /> : 'Test'}
            </button>
          </div>

          {testResults.google && (
            <div
              className={`text-xs p-2 rounded ${
                testResults.google.success
                  ? 'bg-[var(--vscode-testing-iconPassed)]/10 text-[var(--vscode-testing-iconPassed)]'
                  : 'bg-[var(--vscode-testing-iconFailed)]/10 text-[var(--vscode-testing-iconFailed)]'
              }`}
            >
              {testResults.google.success ? (
                <span className="flex items-center gap-1">
                  <Check size={12} /> {testResults.google.message || 'API key is valid'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <X size={12} /> {testResults.google.error}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
            Used for: Gemini models, Imagen 3 (coming soon)
            <a
              href="https://aistudio.google.com/apikey"
              className="ml-2 inline-flex items-center gap-1 text-[var(--vscode-textLink-foreground)] hover:underline"
            >
              Get API key <ExternalLink size={10} />
            </a>
          </p>
        </div>
      </section>

      {/* AI Model Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-[var(--vscode-foreground)]" />
          <h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
            AI Model
          </h2>
        </div>

        <div className="p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
          <label className="text-sm font-medium text-[var(--vscode-foreground)] block mb-2">
            Model for Ritemark AI Assistant
          </label>

          <select
            value={settings.aiModel || getDefaultAssistantModel()}
            onChange={(e) => handleSettingChange('ai.model', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          >
            {(settings.availableModels || []).map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} - {model.description}
              </option>
            ))}
          </select>

          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
            GPT-5 models use the newer Responses API with enhanced reasoning.
            GPT-4 models use Chat Completions API with tool support.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-[var(--vscode-foreground)]" />
          <h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
            Features
          </h2>
        </div>

        <div className="space-y-3">
          <ToggleRow
            label="Voice Dictation"
            description="Speech-to-text using Whisper (experimental, macOS only)"
            checked={settings.voiceDictation}
            onChange={(value) => handleToggle('features.voice-dictation', value)}
          />

          <ToggleRow
            label="Ritemark Flows"
            description="Visual automation workflows with AI and file operations"
            checked={settings.ritemarkFlows}
            onChange={(value) => handleToggle('features.ritemark-flows', value)}
          />
        </div>
      </section>

      {/* Updates Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-[var(--vscode-foreground)]" />
          <h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
            Updates
          </h2>
        </div>

        <ToggleRow
          label="Check for updates on startup"
          description="Notify when a new version of Ritemark is available"
          checked={settings.updatesEnabled}
          onChange={(value) => handleToggle('updates.enabled', value)}
        />
      </section>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
      <div>
        <div className="text-sm font-medium text-[var(--vscode-foreground)]">{label}</div>
        <div className="text-xs text-[var(--vscode-descriptionForeground)]">{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors ${
          checked
            ? 'bg-[var(--vscode-button-background)]'
            : 'bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)]'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
