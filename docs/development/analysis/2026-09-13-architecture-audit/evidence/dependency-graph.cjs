#!/usr/bin/env node
// Syntax-based first-party module inventory. Reads product files; writes audit JSON.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../../../../..');
const ts = require(path.join(root, 'extensions/ritemark/node_modules/typescript'));
const tracked = cp.execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0');
const files = tracked.filter(p => /^extensions\/ritemark\/(src|webview\/src)\//.test(p) && /\.tsx?$/.test(p));
const fileset = new Set(files);
const production = new Set(files.filter(p => !/\.(test|spec|d)\.tsx?$/.test(p)));
const edges = [];
const unresolved = [];
const exported = {};
const group = p => {
  const [base, tail] = p.includes('/webview/src/') ? ['webview', p.split('/webview/src/')[1]] : ['host', p.split('/src/')[1]];
  return `${base}/${tail.includes('/') ? tail.split('/')[0] : '(root)'}`;
};
function resolve(from, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null;
  const full = spec.startsWith('@/') ? path.join(root, 'extensions/ritemark/webview/src', spec.slice(2)) : path.resolve(root, path.dirname(from), spec);
  const stem = full.replace(/\.jsx?$/, '');
  const options = [full, `${stem}.ts`, `${stem}.tsx`, `${stem}.d.ts`, `${full}/index.ts`, `${full}/index.tsx`];
  for (const option of options) {
    const relative = path.relative(root, option).split(path.sep).join('/');
    if (fileset.has(relative)) return relative;
  }
  return undefined;
}
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  exported[file] = [];
  const add = (spec, kind, node) => {
    const target = resolve(file, spec);
    const edge = { from: file, spec, to: target ?? null, kind, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 };
    edges.push(edge);
    if (target === undefined) unresolved.push(edge);
  };
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const onlyTypes = clause?.isTypeOnly || (clause && !clause.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every(n => n.isTypeOnly));
      add(node.moduleSpecifier.text, onlyTypes ? 'type' : 'static', node);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.exportClause;
      const onlyTypes = node.isTypeOnly || (clause && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every(n => n.isTypeOnly));
      add(node.moduleSpecifier.text, onlyTypes ? 'type' : 'static', node);
    } else if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0].text, 'dynamic', node);
      else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') add(node.arguments[0].text, 'require', node);
    }
    if (node.name && ts.isIdentifier(node.name) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) exported[file].push(node.name.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const local = edges.filter(e => production.has(e.from) && e.to && production.has(e.to) && e.kind !== 'type');
const adjacency = new Map([...production].map(p => [p, new Set()]));
for (const edge of local) adjacency.get(edge.from).add(edge.to);
// Tarjan SCC over conservative runtime dependencies (includes deferred requires/imports).
let nextIndex = 0;
const indices = new Map(), low = new Map(), stack = [], onStack = new Set(), scc = [];
function connect(v) {
  indices.set(v, nextIndex); low.set(v, nextIndex++); stack.push(v); onStack.add(v);
  for (const w of adjacency.get(v)) {
    if (!indices.has(w)) { connect(w); low.set(v, Math.min(low.get(v), low.get(w))); }
    else if (onStack.has(w)) low.set(v, Math.min(low.get(v), indices.get(w)));
  }
  if (indices.get(v) === low.get(v)) {
    const component = []; let w;
    do { w = stack.pop(); onStack.delete(w); component.push(w); } while (w !== v);
    if (component.length > 1 || adjacency.get(v).has(v)) scc.push(component.sort());
  }
}
for (const v of production) if (!indices.has(v)) connect(v);
const cross = new Map();
for (const e of local) {
  const a = group(e.from), b = group(e.to);
  if (a !== b) { const key = `${a} -> ${b}`; cross.set(key, (cross.get(key) || 0) + 1); }
}
const top = (field) => [...production].map(p => ({ path: p, count: local.filter(e => e[field] === p).length })).sort((a,b) => b.count-a.count || a.path.localeCompare(b.path)).slice(0,15);
const result = {
  baseline: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  compilerVersion: ts.version,
  method: 'TypeScript syntax AST; literal imports/reexports/require/import(); explicit type-only edges excluded from runtime SCC; includes deferred and unreachable syntax, so this is a dependency graph, not an execution trace. Nonliteral and hidden new Function imports need manual tracing. External package internals omitted.',
  productionModules: production.size, testAndTypeModules: files.length-production.size,
  edges, unresolvedLocalImports: unresolved,
  runtimeStronglyConnectedComponents: scc.sort((a,b) => b.length-a.length),
  crossGroupEdges: [...cross].map(([edge,count]) => ({edge,count})).sort((a,b) => b.count-a.count),
  topOutgoing: top('from'), topIncoming: top('to'), exported,
};
fs.writeFileSync(path.join(__dirname, 'dependency-graph.json'), JSON.stringify(result, null, 2)+'\n');
console.log(JSON.stringify({ productionModules: result.productionModules, edges: edges.length, unresolved: unresolved.length, cycles: result.runtimeStronglyConnectedComponents, topOutgoing: result.topOutgoing.slice(0,8), topIncoming: result.topIncoming.slice(0,8) }, null, 2));
