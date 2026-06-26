import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

async function importPluginEntryForTest() {
  const source = readFileSync(join(root, 'dist/index.js'), 'utf8')
    .replace(
      "import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';",
      'const definePluginEntry = (entry) => entry;',
    )
    .replace(
      "from './companion-protocol.js';",
      `from '${pathToFileURL(join(root, 'dist/companion-protocol.js')).href}';`,
    )
    .replace(
      "from './plugin-inventory.js';",
      `from '${pathToFileURL(join(root, 'dist/plugin-inventory.js')).href}';`,
    );
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(moduleUrl);
}

function createFakeApi({ withOn = true } = {}) {
  const gatewayMethods = new Map();
  const tools = [];
  const hooks = new Map();
  const api = {
    registerGatewayMethod(name, handler) {
      gatewayMethods.set(name, handler);
    },
    registerTool(tool) {
      tools.push(tool);
    },
  };

  if (withOn) {
    api.on = (event, handler) => {
      hooks.set(event, handler);
    };
  }

  return { api, gatewayMethods, tools, hooks };
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

  assert.deepEqual(protocol.DESKTOP_NODE_CAPS, [
    'desktop',
    'desktop.artifacts',
    'desktop.repository',
    'desktop.outputs',
  ]);
  assert.deepEqual(protocol.DESKTOP_NODE_COMMANDS, [
    'desktop.artifacts.create',
    'desktop.artifacts.open',
    'desktop.artifacts.update',
    'desktop.artifacts.append',
    'desktop.repository.status',
    'desktop.repository.init',
    'desktop.repository.read',
    'desktop.repository.write',
    'desktop.repository.search',
    'desktop.repository.git.status',
    'desktop.repository.git.diff',
    'desktop.repository.git.log',
    'desktop.repository.git.commit',
    'desktop.repository.session-summary.write',
    'desktop.outputs.create',
    'desktop.outputs.open',
    'desktop.outputs.update',
    'desktop.outputs.append',
    'desktop.notify',
  ]);
});

test('protocol declares repository context capability and Desktop repository/output support', async () => {
  const protocol = await import(pathToFileURL(join(root, 'dist/companion-protocol.js')));

  assert.equal(protocol.PROTOCOL_VERSION, 2);
  assert.deepEqual(protocol.CAPABILITIES, ['artifacts', 'outputs', 'repository', 'repository-context']);
  assert.ok(protocol.DESKTOP_NODE_CAPS.includes('desktop.repository'));
  assert.ok(protocol.DESKTOP_NODE_CAPS.includes('desktop.outputs'));
  assert.ok(protocol.DESKTOP_NODE_COMMANDS.includes('desktop.repository.status'));
  assert.ok(protocol.DESKTOP_NODE_COMMANDS.includes('desktop.repository.git.diff'));
  assert.ok(protocol.DESKTOP_NODE_COMMANDS.includes('desktop.outputs.create'));
  assert.ok(protocol.DESKTOP_NODE_COMMANDS.includes('desktop.outputs.append'));
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

test('plugin entry registers repository context RPC methods and before prompt hook', () => {
  const source = readFileSync(join(root, 'dist/index.js'), 'utf8');

  assert.match(source, /desktopCompanion\.repositoryContext\.set/);
  assert.match(source, /desktopCompanion\.repositoryContext\.get/);
  assert.match(source, /desktopCompanion\.repositoryContext\.clear/);
  assert.match(source, /before_prompt_build/);
  assert.match(source, /appendSystemContext/);
  assert.match(source, /OpenClaw Desktop Bound Repository/);
  assert.match(source, /Repository absolute path/);
  assert.match(source, /Repository AGENTS\.md/);
  assert.match(source, /Invalid repository context payload/);
});

test('plugin repository context RPCs manage metadata and prompt context', async () => {
  const plugin = (await importPluginEntryForTest()).default;
  const { api, gatewayMethods, hooks } = createFakeApi();
  plugin.register(api);

  const set = gatewayMethods.get('desktopCompanion.repositoryContext.set');
  const get = gatewayMethods.get('desktopCompanion.repositoryContext.get');
  const clear = gatewayMethods.get('desktopCompanion.repositoryContext.clear');
  const beforePromptBuild = hooks.get('before_prompt_build');
  assert.equal(typeof set, 'function');
  assert.equal(typeof get, 'function');
  assert.equal(typeof clear, 'function');
  assert.equal(typeof beforePromptBuild, 'function');

  assert.deepEqual(set(null, { version: 2 }), {
    ok: false,
    error: 'invalid-params',
    message: 'Invalid repository context payload',
  });

  const payload = {
    version: 1,
    instanceId: 'instance-a',
    bindingId: 'binding-a',
    repoPath: '/Users/deepin/Desktop/Company/openclaw-desktop',
    agentsMdContent: '# Repo Rules\n\n- Speak Chinese.',
    agentsMdHash: 'hash-a',
    updatedAt: 123,
  };
  const updated = set(null, payload);
  assert.equal(updated.ok, true);
  assert.equal(updated.status, 'updated');
  assert.equal(updated.agentsMdHash, 'hash-a');
  assert.equal(updated.context.agentsMdHash, 'hash-a');
  assert.equal(updated.context.repoPath, payload.repoPath);
  assert.equal(updated.context.agentsMdContent, undefined);

  const unchanged = set(null, { ...payload });
  assert.equal(unchanged.ok, true);
  assert.equal(unchanged.status, 'unchanged');
  assert.equal(unchanged.agentsMdHash, 'hash-a');

  const switchedBinding = set(null, { ...payload, bindingId: 'binding-b' });
  assert.equal(switchedBinding.status, 'updated');

  const found = get();
  assert.equal(found.ok, true);
  assert.equal(found.context.bindingId, 'binding-b');
  assert.equal(found.context.agentsMdHash, 'hash-a');
  assert.equal(found.context.agentsMdContent, undefined);

  const promptContext = await beforePromptBuild();
  assert.match(promptContext.appendSystemContext, /OpenClaw Desktop Bound Repository/);
  assert.match(promptContext.appendSystemContext, /\/Users\/deepin\/Desktop\/Company\/openclaw-desktop/);
  assert.match(promptContext.appendSystemContext, /# Repo Rules/);
  assert.match(promptContext.appendSystemContext, /not a user message/i);

  const wrongClear = clear(null, { bindingId: 'binding-a' });
  assert.equal(wrongClear.ok, true);
  assert.equal(wrongClear.status, 'cleared');
  assert.equal(wrongClear.cleared, false);
  assert.equal(wrongClear.context.bindingId, 'binding-b');

  const correctClear = clear(null, { bindingId: 'binding-b' });
  assert.equal(correctClear.ok, true);
  assert.equal(correctClear.status, 'cleared');
  assert.equal(correctClear.cleared, true);
  assert.equal(correctClear.context, null);
  assert.equal(await beforePromptBuild(), undefined);
});

test('plugin register works without api.on and still registers base RPCs and tools', async () => {
  const plugin = (await importPluginEntryForTest()).default;
  const { api, gatewayMethods, tools } = createFakeApi({ withOn: false });

  assert.doesNotThrow(() => plugin.register(api));
  assert.equal(gatewayMethods.has('desktopCompanion.status'), true);
  assert.equal(gatewayMethods.has('desktopCompanion.repositoryContext.set'), true);
  assert.deepEqual(tools.map((tool) => tool.name), [
    'desktop_artifact_create',
    'desktop_artifact_update',
    'desktop_artifact_append',
    'desktop_artifact_open',
  ]);
});
