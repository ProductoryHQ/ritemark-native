// Score the spike's runs: per run, which of the newest files' planted facts the answer gives, approvals, time,
// tool uses, offers. node analyze.mjs [--tail]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const SPIKE_DIR = process.env.SPIKE_DIR || join(tmpdir(), 's140');
const dir = join(SPIKE_DIR, 'runs');
const facts = JSON.parse(readFileSync(join(SPIKE_DIR, 'facts.json'), 'utf8'));
const offersLog = join(SPIKE_DIR, 'offers.jsonl');
const offers = existsSync(offersLog) ? readFileSync(offersLog, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const tail = process.argv.includes('--tail');
const rows = [];
for (const file of readdirSync(dir).filter(f => f.endsWith('.summary.json')).sort()) {
	const s = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
	const answer = s.answer?.content ?? '';
	const folder = s.name.includes('pdfonly') ? 'Training PDFs' : 'Training work';
	let read = null;
	if (s.name.includes('open-word')) {
		const od = facts.open_document;
		read = od.facts.filter(f => answer.includes(f)).length + '/' + od.facts.length + (answer.toLowerCase().includes(od.decoy) ? ' (names decoy)' : '');
	} else if (!s.name.includes('chat-')) {
		read = facts[folder].map(entry => ({ file: entry.file.split('/').pop(), ok: entry.facts.some(f => answer.toLowerCase().includes(f.toLowerCase())) }));
	}
	let tools = null;
	try {
		const trace = JSON.parse(readFileSync(`${dir}/${s.name}.trace.json`, 'utf8'));
		tools = trace.filter(m => m.progress?.type === 'tool_use').map(m => m.progress.tool || m.progress.message).reduce((acc, t) => ({ ...acc, [t]: (acc[t] || 0) + 1 }), {});
	} catch { /* no trace */ }
	const start = Date.parse(s.answer ? JSON.parse(readFileSync(`${dir}/${s.name}.record.json`, 'utf8')).events[0].occurredAt : 0);
	const madeOffers = offers.filter(o => Date.parse(o.at) >= start && Date.parse(o.at) <= start + s.elapsedMs + 5000);
	rows.push({ run: s.name, secs: Math.round(s.elapsedMs / 1000), state: s.lifecycle?.state, answer: s.answer?.status ?? null, approvals: s.attentions.length, failed: s.boundaries.filter(b => b.kind === 'failed').length, read, tools, offers: madeOffers.length ? madeOffers.map(o => o.offers.map(x => x.title)) : 0 });
	if (tail) console.log(`== ${s.name}\n${answer.slice(-600)}\n`);
}
console.log(JSON.stringify(rows, null, 1));
