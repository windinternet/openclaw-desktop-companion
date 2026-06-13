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

test('plugin inventory CLI args and timeout stay constrained', async () => {
  const inventory = await import(pathToFileURL(join(root, 'dist/plugin-inventory.js')));

  assert.deepEqual(inventory.buildPluginListArgv({}), ['openclaw', 'plugins', 'list', '--json']);
  assert.deepEqual(inventory.buildPluginListArgv({ enabled: true }), [
    'openclaw',
    'plugins',
    'list',
    '--json',
    '--enabled',
  ]);
  assert.deepEqual(inventory.buildPluginListArgv({ command: 'rm -rf /' }), ['openclaw', 'plugins', 'list', '--json']);

  assert.equal(inventory.clampPluginListTimeoutMs(undefined), 30000);
  assert.equal(inventory.clampPluginListTimeoutMs(1000), 5000);
  assert.equal(inventory.clampPluginListTimeoutMs(45000), 45000);
  assert.equal(inventory.clampPluginListTimeoutMs(999999), 120000);
});

test('companion plugin management CLI args stay constrained', async () => {
  const inventory = await import(pathToFileURL(join(root, 'dist/plugin-inventory.js')));

  assert.deepEqual(inventory.buildCompanionPluginReinstallCommands({ command: 'rm -rf /' }), [
    [
      'openclaw',
      'plugins',
      'install',
      'git:github.com/windinternet/openclaw-desktop-companion@main',
      '--force',
    ],
    ['openclaw', 'plugins', 'enable', 'openclaw-desktop-companion'],
  ]);
  assert.deepEqual(inventory.buildCompanionPluginUninstallCommands({ keepFiles: true }), [
    ['openclaw', 'plugins', 'uninstall', 'openclaw-desktop-companion', '--force'],
  ]);

  assert.equal(inventory.clampPluginManageTimeoutMs(undefined), 120000);
  assert.equal(inventory.clampPluginManageTimeoutMs(1000), 10000);
  assert.equal(inventory.clampPluginManageTimeoutMs(180000), 180000);
  assert.equal(inventory.clampPluginManageTimeoutMs(999999), 300000);
});

test('plugin inventory parser maps CLI stdout and failures to RPC payloads', async () => {
  const inventory = await import(pathToFileURL(join(root, 'dist/plugin-inventory.js')));
  const argv = ['openclaw', 'plugins', 'list', '--json'];

  const success = inventory.createPluginListSuccess({
    stdout: JSON.stringify({
      registry: { source: 'persisted', diagnostics: [] },
      plugins: [{ id: 'openai', name: 'OpenAI', enabled: true, status: 'loaded' }],
      diagnostics: [],
    }),
    argv,
    startedAt: 10,
    endedAt: 35,
    enabledOnly: false,
  });

  assert.equal(success.ok, true);
  assert.equal(success.source, 'cli');
  assert.deepEqual(success.argv, argv);
  assert.equal(success.durationMs, 25);
  assert.equal(success.plugins[0].id, 'openai');

  assert.equal(inventory.createPluginListFailure(new Error('spawn openclaw ENOENT'), 10, 30).error, 'cli-not-found');
  assert.equal(inventory.createPluginListFailure(Object.assign(new Error('timed out'), { killed: true }), 10, 30).error, 'cli-timeout');
  assert.equal(
    inventory.createPluginListFailure(Object.assign(new Error('bad exit'), { code: 2, stderr: 'bad'.repeat(20000) }), 10, 30).stderr.length,
    inventory.PLUGIN_LIST_STDERR_LIMIT,
  );
  assert.equal(inventory.createPluginListSuccess({
    stdout: '{bad json',
    argv,
    startedAt: 10,
    endedAt: 30,
    enabledOnly: false,
  }).error, 'cli-json-invalid');
});

test('companion plugin management results include restart guidance', async () => {
  const inventory = await import(pathToFileURL(join(root, 'dist/plugin-inventory.js')));
  const command = ['openclaw', 'plugins', 'uninstall', 'openclaw-desktop-companion', '--force'];

  const success = inventory.createPluginManageSuccess({
    action: 'uninstall',
    commands: [command],
    startedAt: 10,
    endedAt: 35,
    results: [{ argv: command, stdout: 'removed', stderr: '' }],
  });

  assert.equal(success.ok, true);
  assert.equal(success.action, 'uninstall');
  assert.equal(success.requiresGatewayRestart, true);
  assert.deepEqual(success.commands, [command]);
  assert.equal(success.results[0].stdout, 'removed');

  const failure = inventory.createPluginManageFailure(
    'reinstall',
    Object.assign(new Error('bad exit'), { code: 2, stderr: 'bad' }),
    10,
    30,
    command,
  );

  assert.equal(failure.ok, false);
  assert.equal(failure.action, 'reinstall');
  assert.equal(failure.error, 'cli-exit-nonzero');
  assert.deepEqual(failure.argv, command);
});

test('plugin entry registers companion plugin management RPC methods', () => {
  const source = readFileSync(join(root, 'dist/index.js'), 'utf8');

  assert.match(source, /desktopCompanion\.plugin\.reinstall/);
  assert.match(source, /desktopCompanion\.plugin\.uninstall/);
});
