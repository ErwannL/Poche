// Échoue si un fichier source dépasse MAX_LINES lignes.
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const MAX_LINES = 1000;
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(
    (f) => /\.(ts|tsx|js|mjs|css|html|md|json|yml|svg)$/.test(f) && f !== 'package-lock.json',
  );

let failed = false;
for (const file of files) {
  const lines = (await readFile(file, 'utf8')).split('\n').length;
  if (lines > MAX_LINES) {
    console.error(`${file}: ${lines} lignes (max ${MAX_LINES})`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`${files.length} fichiers vérifiés, tous ≤ ${MAX_LINES} lignes.`);
