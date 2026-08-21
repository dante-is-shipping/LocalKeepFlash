import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = new URL('../.output/chrome-mv3/', import.meta.url);
const forbidden = [
  /https?:\/\/keepflash\.com/i,
  /\/api\/auth\//i,
  /credentials\s*:\s*['"]include['"]/i,
  /posthog/i,
  /@keepflash\/web-contracts/i,
];

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
      return entry.isDirectory() ? files(target) : [target];
    }),
  );
  return nested.flat();
}

const failures = [];
for (const file of await files(root)) {
  if (!/\.(?:js|json|html|css)$/.test(file.pathname)) continue;
  const content = await readFile(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(content)) failures.push(`${path.basename(file.pathname)} matched ${pattern}`);
  }
}

if (failures.length) {
  throw new Error(`Build audit failed:\n${failures.join('\n')}`);
}

console.log('Build audit passed: no commercial API, auth-cookie, analytics, or private-contract markers.');
