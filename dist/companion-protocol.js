export const PLUGIN_ID = 'openclaw-desktop-companion';
export const PLUGIN_VERSION = '0.1.0';
export const PROTOCOL_VERSION = 1;

export const CAPABILITIES = ['artifacts'];

export const DESKTOP_NODE_CAPS = ['desktop', 'desktop.artifacts'];

export const DESKTOP_NODE_COMMANDS = [
  'desktop.artifacts.create',
  'desktop.artifacts.open',
  'desktop.artifacts.update',
  'desktop.artifacts.append',
  'desktop.notify',
];

export const ARTIFACT_TOOLS = [
  'desktop_artifact_create',
  'desktop_artifact_update',
  'desktop_artifact_append',
  'desktop_artifact_open',
];

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
