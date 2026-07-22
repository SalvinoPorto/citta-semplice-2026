// Copia in public/ gli asset di bootstrap-italia serviti come file statici:
// gli sprite SVG (referenziati via <use href="/bootstrap-italia/...">) e il
// bundle JS, caricato da app/layout.tsx con next/script.
// Eseguito da `npm run postinstall`.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Con gli npm workspaces bootstrap-italia viene hoistato nel node_modules di
// root: risolviamo il package invece di assumere ./node_modules locale.
const require = createRequire(import.meta.url);
const SRC = path.join(
  path.dirname(require.resolve('bootstrap-italia/package.json')),
  'dist'
);
const DST = path.resolve(import.meta.dirname, '..', 'public/bootstrap-italia/dist');

function copyDir(rel) {
  const src = path.join(SRC, rel);
  const dst = path.join(DST, rel);
  fs.mkdirSync(dst, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, file), path.join(dst, file));
  }
}

function copyFile(rel) {
  const dst = path.join(DST, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(SRC, rel), dst);
}

copyDir('svg');
copyFile('js/bootstrap-italia.bundle.min.js');
