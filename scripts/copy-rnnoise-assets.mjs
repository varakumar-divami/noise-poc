// Copies the RNNoise worklet + wasm binaries out of node_modules into public/
// so they can be loaded as plain static assets via ctx.audioWorklet.addModule()
// and fetch(), sidestepping any ambiguity in bundling wasm/worklet files through
// Vite's dependency pre-bundling. Re-run automatically on `pnpm install`.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgDir = join(rootDir, 'node_modules', '@sapphi-red', 'web-noise-suppressor', 'dist');
const outDir = join(rootDir, 'public', 'rnnoise');

const files = [
  ['rnnoise/workletProcessor.js', 'rnnoiseWorklet.js'],
  ['rnnoise.wasm', 'rnnoise.wasm'],
  ['rnnoise_simd.wasm', 'rnnoise_simd.wasm'],
];

if (!existsSync(pkgDir)) {
  console.warn('[copy-rnnoise-assets] @sapphi-red/web-noise-suppressor not installed yet, skipping.');
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });

for (const [src, dest] of files) {
  const srcPath = join(pkgDir, src);
  const destPath = join(outDir, dest);
  if (!existsSync(srcPath)) {
    console.warn(`[copy-rnnoise-assets] missing ${srcPath}, skipping.`);
    continue;
  }
  copyFileSync(srcPath, destPath);
}

console.log('[copy-rnnoise-assets] RNNoise assets copied to public/rnnoise/.');
