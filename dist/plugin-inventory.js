import { execFile } from 'node:child_process';

export const PLUGIN_LIST_STDOUT_LIMIT = 4 * 1024 * 1024;
export const PLUGIN_LIST_STDERR_LIMIT = 32 * 1024;
export const PLUGIN_MANAGE_STDOUT_LIMIT = 256 * 1024;
export const PLUGIN_MANAGE_STDERR_LIMIT = 32 * 1024;
export const DESKTOP_COMPANION_PLUGIN_ID = 'openclaw-desktop-companion';
export const DESKTOP_COMPANION_INSTALL_SPEC = 'git:github.com/windinternet/openclaw-desktop-companion@main';
const DEFAULT_LIST_TIMEOUT_MS = 30000;
const MIN_LIST_TIMEOUT_MS = 5000;
const MAX_LIST_TIMEOUT_MS = 120000;
const DEFAULT_MANAGE_TIMEOUT_MS = 120000;
const MIN_MANAGE_TIMEOUT_MS = 10000;
const MAX_MANAGE_TIMEOUT_MS = 300000;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function truncateText(value, limit) {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return text.length > limit ? text.slice(0, limit) : text;
}

export function buildPluginListArgv(params = {}) {
  const args = ['openclaw', 'plugins', 'list', '--json'];
  if (asObject(params).enabled === true) args.push('--enabled');
  return args;
}

export function buildCompanionPluginReinstallCommands() {
  return [
    ['openclaw', 'plugins', 'install', DESKTOP_COMPANION_INSTALL_SPEC, '--force'],
    ['openclaw', 'plugins', 'enable', DESKTOP_COMPANION_PLUGIN_ID],
  ];
}

export function buildCompanionPluginUninstallCommands() {
  return [
    ['openclaw', 'plugins', 'uninstall', DESKTOP_COMPANION_PLUGIN_ID, '--force'],
  ];
}

export function clampPluginListTimeoutMs(timeoutMs) {
  const value = Number.isFinite(timeoutMs) ? Number(timeoutMs) : DEFAULT_LIST_TIMEOUT_MS;
  return Math.min(MAX_LIST_TIMEOUT_MS, Math.max(MIN_LIST_TIMEOUT_MS, value));
}

export function clampPluginManageTimeoutMs(timeoutMs) {
  const value = Number.isFinite(timeoutMs) ? Number(timeoutMs) : DEFAULT_MANAGE_TIMEOUT_MS;
  return Math.min(MAX_MANAGE_TIMEOUT_MS, Math.max(MIN_MANAGE_TIMEOUT_MS, value));
}

function classifyCliError(error) {
  let code = 'unknown';
  const errorCode = error?.code;
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown plugin inventory error');

  if (errorCode === 'ENOENT' || /spawn openclaw ENOENT/u.test(message)) {
    code = 'cli-not-found';
  } else if (error?.killed === true || error?.signal === 'SIGTERM' || /timed out|timeout/u.test(message)) {
    code = 'cli-timeout';
  } else if (errorCode === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' || /maxBuffer|stdout maxBuffer/u.test(message)) {
    code = 'cli-output-too-large';
  } else if (errorCode !== undefined) {
    code = 'cli-exit-nonzero';
  }

  return { code, message };
}

export function createPluginListFailure(error, startedAt, endedAt = Date.now()) {
  const stderr = truncateText(error?.stderr ?? error?.message ?? '', PLUGIN_LIST_STDERR_LIMIT);
  const { code, message } = classifyCliError(error);

  return {
    ok: false,
    source: 'cli',
    error: code,
    message,
    durationMs: Math.max(0, endedAt - startedAt),
    ...(stderr ? { stderr } : {}),
  };
}

export function createPluginManageFailure(action, error, startedAt, endedAt = Date.now(), argv = undefined) {
  const stderr = truncateText(error?.stderr ?? error?.message ?? '', PLUGIN_MANAGE_STDERR_LIMIT);
  const stdout = truncateText(error?.stdout ?? '', PLUGIN_MANAGE_STDOUT_LIMIT);
  const { code, message } = classifyCliError(error);

  return {
    ok: false,
    source: 'cli',
    action,
    error: code,
    message,
    durationMs: Math.max(0, endedAt - startedAt),
    ...(argv ? { argv } : {}),
    ...(stdout ? { stdout } : {}),
    ...(stderr ? { stderr } : {}),
  };
}

export function createPluginListSuccess({ stdout, argv, startedAt, endedAt = Date.now(), enabledOnly = false }) {
  if (typeof stdout === 'string' && stdout.length > PLUGIN_LIST_STDOUT_LIMIT) {
    return {
      ok: false,
      source: 'cli',
      error: 'cli-output-too-large',
      message: `openclaw plugins list output exceeded ${PLUGIN_LIST_STDOUT_LIMIT} bytes`,
      durationMs: Math.max(0, endedAt - startedAt),
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    return {
      ok: false,
      source: 'cli',
      error: 'cli-json-invalid',
      message: err instanceof Error ? err.message : 'openclaw plugins list returned invalid JSON',
      durationMs: Math.max(0, endedAt - startedAt),
    };
  }

  const payload = asObject(parsed);
  return {
    ok: true,
    source: 'cli',
    argv,
    enabledOnly,
    capturedAt: endedAt,
    durationMs: Math.max(0, endedAt - startedAt),
    registry: asObject(payload.registry),
    plugins: Array.isArray(payload.plugins) ? payload.plugins : [],
    diagnostics: Array.isArray(payload.diagnostics) ? payload.diagnostics : [],
  };
}

export function createPluginManageSuccess({ action, commands, results, startedAt, endedAt = Date.now() }) {
  return {
    ok: true,
    source: 'cli',
    action,
    commands,
    results: Array.isArray(results)
      ? results.map((result) => ({
        argv: result.argv,
        stdout: truncateText(result.stdout ?? '', PLUGIN_MANAGE_STDOUT_LIMIT),
        stderr: truncateText(result.stderr ?? '', PLUGIN_MANAGE_STDERR_LIMIT),
      }))
      : [],
    requiresGatewayRestart: true,
    message: 'Plugin files changed. Restart or reload the Gateway runtime before relying on the updated plugin state.',
    durationMs: Math.max(0, endedAt - startedAt),
  };
}

function runOpenClawCommand(argv, timeoutMs) {
  const [, ...args] = argv;

  return new Promise((resolve, reject) => {
    execFile('openclaw', args, {
      timeout: timeoutMs,
      maxBuffer: PLUGIN_MANAGE_STDOUT_LIMIT + PLUGIN_MANAGE_STDERR_LIMIT,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { argv, stdout, stderr }));
        return;
      }
      resolve({ argv, stdout, stderr });
    });
  });
}

async function runCompanionPluginManageCli(action, commands, params = {}) {
  const request = asObject(params);
  const startedAt = Date.now();
  const timeoutMs = clampPluginManageTimeoutMs(request.timeoutMs);
  const results = [];

  try {
    for (const argv of commands) {
      results.push(await runOpenClawCommand(argv, timeoutMs));
    }
    return createPluginManageSuccess({
      action,
      commands,
      results,
      startedAt,
      endedAt: Date.now(),
    });
  } catch (error) {
    return createPluginManageFailure(action, error, startedAt, Date.now(), error?.argv);
  }
}

export async function runPluginListCli(params = {}) {
  const request = asObject(params);
  const argv = buildPluginListArgv(request);
  const startedAt = Date.now();
  const timeoutMs = clampPluginListTimeoutMs(request.timeoutMs);
  const [, ...args] = argv;

  return new Promise((resolve) => {
    execFile('openclaw', args, {
      timeout: timeoutMs,
      maxBuffer: PLUGIN_LIST_STDOUT_LIMIT + PLUGIN_LIST_STDERR_LIMIT,
    }, (error, stdout, stderr) => {
      const endedAt = Date.now();
      if (error) {
        resolve(createPluginListFailure(Object.assign(error, { stderr }), startedAt, endedAt));
        return;
      }
      resolve(createPluginListSuccess({
        stdout,
        argv,
        startedAt,
        endedAt,
        enabledOnly: request.enabled === true,
      }));
    });
  });
}

export function runCompanionPluginReinstallCli(params = {}) {
  return runCompanionPluginManageCli('reinstall', buildCompanionPluginReinstallCommands(), params);
}

export function runCompanionPluginUninstallCli(params = {}) {
  return runCompanionPluginManageCli('uninstall', buildCompanionPluginUninstallCommands(), params);
}
