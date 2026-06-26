export const PLUGIN_ID = 'openclaw-desktop-companion';
export const PLUGIN_VERSION = '0.1.0';
export const PROTOCOL_VERSION = 2;

export const CAPABILITIES = ['artifacts', 'outputs', 'repository', 'repository-context'];

export const DESKTOP_NODE_CAPS = ['desktop', 'desktop.artifacts', 'desktop.repository', 'desktop.outputs'];

export const DESKTOP_NODE_COMMANDS = [
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
];

export const ARTIFACT_TOOLS = [
  'desktop_artifact_create',
  'desktop_artifact_update',
  'desktop_artifact_append',
  'desktop_artifact_open',
];

export const REPOSITORY_TOOLS = [
  'desktop_repository_status',
  'desktop_repository_read',
  'desktop_repository_search',
  'desktop_repository_write',
  'desktop_repository_git_status',
  'desktop_repository_git_diff',
  'desktop_repository_git_log',
  'desktop_repository_git_commit',
];

export const OUTPUT_TOOLS = [
  'desktop_outputs_create',
  'desktop_outputs_open',
  'desktop_outputs_update',
  'desktop_outputs_append',
];

export const AGENT_TOOLS = ARTIFACT_TOOLS.concat(REPOSITORY_TOOLS, OUTPUT_TOOLS);

export function createStatusPayload(overrides = {}) {
  return {
    ok: true,
    pluginId: PLUGIN_ID,
    version: PLUGIN_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    capabilities: CAPABILITIES,
    requiredDesktopNodeCaps: DESKTOP_NODE_CAPS,
    requiredDesktopNodeCommands: DESKTOP_NODE_COMMANDS,
    ...overrides,
  };
}
