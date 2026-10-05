// Prints a compact timeline of a probe JSONL (stream_event deltas omitted).
import { readFileSync } from 'fs';
const short = (id) => (id ? String(id).slice(-6) : '');
for (const e of readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l))) {
  if (e.kind !== 'msg') { console.log(e.t, e.kind.toUpperCase(), JSON.stringify(e.reason ?? e.action ?? e.via ?? e.message?.origin ?? '')); continue; }
  const m = e.message;
  if (m.type === 'stream_event') continue;
  let d = '';
  if (m.type === 'assistant') d = (m.message.content || []).map((c) => c.type === 'text' ? `TEXT:${c.text.slice(0, 60)}` : c.type === 'tool_use' ? `TOOL:${c.name} bg=${c.input?.run_in_background} id=${short(c.id)}` : c.type).join(' | ') + ` parent=${short(m.parent_tool_use_id)}`;
  if (m.type === 'user') d = (Array.isArray(m.message.content) ? m.message.content.map((c) => c.type + (c.tool_use_id ? ':' + short(c.tool_use_id) : '') + (c.type === 'text' ? ':' + c.text.slice(0, 50) : '')).join(',') : 'text:' + String(m.message.content).slice(0, 80)) + ` parent=${short(m.parent_tool_use_id)}`;
  if (m.type === 'system') d = [m.task_id, m.tool_use_id && 'tu=' + short(m.tool_use_id), m.status, m.state, m.is_backgrounded !== undefined && 'bg=' + m.is_backgrounded, m.tasks && JSON.stringify(m.tasks.map((t) => [t.task_id, t.status, t.type ?? t.kind, t.ambient]))].filter(Boolean).join(' ');
  if (m.type === 'result') d = `${m.subtype} ${(m.result || '').slice(0, 60)}`;
  console.log(e.t, m.type, m.subtype || '', m.origin ? JSON.stringify(m.origin) : '', d.slice(0, 220));
}
