import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The repo package.json is "type": "module". Expo's web server export is CommonJS.
 * A package.json in the export dir keeps `expo serve` from parsing that output as ESM.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const marker = JSON.stringify({ type: 'commonjs' }) + '\n';
for (const dir of [root, join(root, 'server')]) {
  if (dir.endsWith('server') && !existsSync(dir)) continue;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), marker);
}
