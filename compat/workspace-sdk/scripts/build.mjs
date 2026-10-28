import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { makePatches } from './patches.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root, 'vendor/ui-workspace');
const input = path.resolve(process.argv[2] ?? vendor);
const output = path.join(root, 'dist/ui-workspace');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pins = {
  'lib/client.js': 'bafd2d6eea2f82674cc0606bec13fc891e44b42fb2ac973f01cb32c735d4062f',
  'lib/index.js': 'e6cdc4b725585354102a5c4598c9d8c79d6abac62d7979c09919821716370438',
  'package.json': '249106ef05cd599e1a9d04d4443529f30e8d8aa914d7feee59357b5d052fc523',
};
const inputs = {};
for (const [file, hash] of Object.entries(pins)) {
  const bytes = fs.readFileSync(path.join(input, file));
  if (sha(bytes) !== hash) throw new Error(`Refusing unrecognized official input: ${file}; expected ${hash}; got ${sha(bytes)}`);
  inputs[file] = bytes;
}
const upstream = JSON.parse(inputs['package.json']);
if (upstream.name !== '@deepseek-ai/dsh-client-ui-workspace' || upstream.version !== '0.2.1-rc.3') throw new Error('Unrecognized identity');
let client = inputs['lib/client.js'].toString('utf8');
const extension = fs.readFileSync(path.join(root, 'src/session-filters.js'), 'utf8');
const edits = makePatches(extension);
for (const edit of edits) {
  const occurrences = client.split(edit.before).length - 1;
  if (occurrences !== edit.count) throw new Error(`Edit ${edit.id}: expected ${edit.count} exact matches; got ${occurrences}`);
  client = client.split(edit.before).join(edit.after);
}
new vm.Script(client, { filename: 'local-ui-workspace-client.js' });
if (!client.includes('id: "@deepseek-ai/dsh-client-ui-workspace"')) throw new Error('Lost module identity');
// All destinations are fixed descendants of this owned builder root. No deletes/moves.
const put = (dir, relative, bytes) => {
  const target = path.resolve(dir, relative);
  if (!target.startsWith(dir + path.sep)) throw new Error('Output escaped owned directory');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) fs.readFileSync(target); // Observe generated previous output before rebuilding.
  fs.writeFileSync(target, bytes);
};
if (input !== vendor) for (const [file, bytes] of Object.entries(inputs)) put(vendor, file, bytes);
put(vendor, 'LICENSE', fs.readFileSync(path.join(root, 'legal/LICENSE')));
for (const file of ['README.md', 'README.zh.md', 'locale/en.json', 'locale/zh.json']) {
  const bytes = fs.readFileSync(path.join(input, file));
  if (input !== vendor) put(vendor, file, bytes);
  if (file.startsWith('locale/')) put(output, file, bytes);
}
const metadata = { ...upstream, private: true, localSdkPatch: {
  kind: 'user-authorized-local-only', apiVersion: 1, baseVersion: upstream.version,
  baseClientSha256: pins['lib/client.js'], clientSha256: sha(client),
} };
put(output, 'package.json', JSON.stringify(metadata, null, 2) + '\n');
put(output, 'lib/index.js', inputs['lib/index.js']);
put(output, 'lib/client.js', client);
for (const file of ['LICENSE', 'NOTICE']) put(output, file, fs.readFileSync(path.join(root, 'legal', file)));
put(output, 'SESSION_FILTERS.d.ts', fs.readFileSync(path.join(root, 'types/session-filters.d.ts')));
put(output, 'README.local.md', fs.readFileSync(path.join(root, 'README.md'), 'utf8').replaceAll('<dist/ui-workspace/>', '<.>').replaceAll('<dist/ui-workspace/', '<').replaceAll('<legal/', '<'));
const audit = {
  patch: 'local-session-filters-v1', upstreamName: upstream.name, baseVersion: upstream.version,
  inputSha256: pins, extensionSha256: sha(extension), clientSha256: sha(client),
  metadataPreserved: ['name', 'version', 'main', 'exports', 'dsh.client', 'peerDependencies', 'devDependencies'],
  edits,
};
put(output, 'AUDIT.json', JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify({ output, clientSha256: sha(client), edits: edits.length, inputSha256: pins }, null, 2));
