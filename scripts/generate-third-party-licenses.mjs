import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const packages = [
  '@mozilla/readability',
  '@wxt-dev/module-react',
  'idb-keyval',
  'react',
  'react-dom',
  'turndown',
  'turndown-plugin-gfm',
  'yaml',
];

const sections = [
  'LocalKeepFlash third-party license texts',
  'Generated from the installed dependency versions recorded in package-lock.json.',
];

function normalizeLicenseText(value) {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

const apacheLicense = normalizeLicenseText(
  await readFile('node_modules/typescript/LICENSE.txt', 'utf8'),
);
sections.push(
  `${'='.repeat(78)}\nApache License 2.0 — shared full text\n${'='.repeat(78)}\n${apacheLicense}`,
);

for (const packageName of packages) {
  const packageDirectory = path.resolve('node_modules', packageName);
  const metadata = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'));
  const licenseFile = (await readdir(packageDirectory)).find((name) => /^licen[cs]e(?:\.|$)/i.test(name));
  if (!licenseFile) throw new Error(`No license file found for ${packageName}.`);
  const license = normalizeLicenseText(
    await readFile(path.join(packageDirectory, licenseFile), 'utf8'),
  );
  sections.push(
    `${'='.repeat(78)}\n${packageName} ${metadata.version} — ${metadata.license ?? 'see text below'}\n${'='.repeat(78)}\n${license}`,
  );
}

await writeFile('public/THIRD_PARTY_LICENSES.txt', `${sections.join('\n\n')}\n`);
