import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

test('manifest declares the Desktop artifact tools from the protocol', async () => {
  const manifest = readJson('openclaw.plugin.json');
  const protocol = await import(pathToFileURL(join(root, 'dist/companion-protocol.js')));

  assert.equal(manifest.id, protocol.PLUGIN_ID);
  assert.equal(manifest.version, protocol.PLUGIN_VERSION);
  assert.deepEqual(manifest.contracts.tools, protocol.ARTIFACT_TOOLS);
  assert.deepEqual(manifest.skills, ['skills']);
});

test('package exposes the built plugin entry for OpenClaw', () => {
  const pkg = readJson('package.json');

  assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.openclaw.extensions, ['./dist/index.js']);
  assert.equal(pkg.scripts.test, 'node --test test/*.test.mjs');
  assert.ok(existsSync(join(root, 'dist/index.js')));
});

test('Desktop node command names stay stable', async () => {
  const protocol = await import(pathToFileURL(join(root, 'dist/companion-protocol.js')));

  assert.deepEqual(protocol.DESKTOP_NODE_CAPS, ['desktop', 'desktop.artifacts']);
  assert.deepEqual(protocol.DESKTOP_NODE_COMMANDS, [
    'desktop.artifacts.create',
    'desktop.artifacts.open',
    'desktop.artifacts.update',
    'desktop.artifacts.append',
    'desktop.notify',
  ]);
});
