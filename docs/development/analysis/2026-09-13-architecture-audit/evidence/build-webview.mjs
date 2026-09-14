// Rebuild into disposable audit output; preserve the committed media artifact.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const evidence = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(evidence, '../../../../..');
const webview = path.join(root, 'extensions/ritemark/webview');
const outDir = '/private/tmp/ritemark-architecture-audit-build/webview';
process.env.RITEMARK_WEBVIEW_SOURCEMAP = 'true';
process.chdir(webview);
const { build } = await import(pathToFileURL(path.join(webview, 'node_modules/vite/dist/node/index.js')));
let report;
const before = fs.readFileSync(path.join(root, 'extensions/ritemark/media/webview.js'));
const hash = data => createHash('sha256').update(data).digest('hex');
const started = performance.now();
await build({
  root: webview,
  build: { outDir, emptyOutDir: true, sourcemap: false },
  plugins: [{
    name: 'audit-module-attribution',
    generateBundle(_options, bundle) {
      report = { chunks: [], assets: [], packages: {}, modules: [] };
      for (const [name, output] of Object.entries(bundle)) {
        if (output.type === 'asset') {
          report.assets.push({ name, bytes: Buffer.byteLength(output.source) });
          continue;
        }
        report.chunks.push({ name, bytes: Buffer.byteLength(output.code), sha256: hash(output.code), isEntry: output.isEntry, imports: output.imports, dynamicImports: output.dynamicImports });
        for (const [id, info] of Object.entries(output.modules)) {
          const normalized = id.replaceAll(root+'/', '').replaceAll('\u0000', '<virtual>');
          const match = id.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/);
          const pkg = match?.[1] ?? '<first-party-or-virtual>';
          report.packages[pkg] = (report.packages[pkg] ?? 0) + info.renderedLength;
          report.modules.push({ id: normalized, chunk: name, package: pkg, renderedLength: info.renderedLength });
        }
      }
    },
  }],
});
const current = fs.readFileSync(path.join(root, 'extensions/ritemark/media/webview.js'));
if (hash(before) !== hash(current)) throw new Error('Audit build changed the committed media bundle');
report = {
  baseline: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version, platform: process.platform, arch: process.arch, outDir,
  buildElapsedMs: performance.now()-started,
  method: 'Actual Vite/Rollup rebuild with baseline production config and locked dependencies; output redirected to disposable directory; sourcemaps disabled as in production. renderedLength is Rollup module attribution before output minification, NOT final compressed package bytes, heap usage or Windows runtime cost.',
  checkedInArtifact: { bytes: before.length, sha256: hash(before), preserved: true },
  ...report,
  packageRenderedLengths: Object.entries(report.packages).map(([name, renderedLength]) => ({name,renderedLength})).sort((a,b)=>b.renderedLength-a.renderedLength),
};
delete report.packages;
fs.writeFileSync(path.join(evidence, 'webview-build.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ chunks: report.chunks, packageRenderedLengths: report.packageRenderedLengths.slice(0,18), checkedInArtifact: report.checkedInArtifact },null,2));
