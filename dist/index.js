import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';
import {
  ARTIFACT_TOOLS,
  CAPABILITIES,
  DESKTOP_NODE_CAPS,
  DESKTOP_NODE_COMMANDS,
  PLUGIN_ID,
  createStatusPayload,
} from './companion-protocol.js';
import {
  runCompanionPluginReinstallCli,
  runCompanionPluginUninstallCli,
  runPluginListCli,
} from './plugin-inventory.js';

const artifactCreateParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: 'Artifact title.' },
    type: {
      type: 'string',
      enum: ['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other'],
      description: 'Artifact type.',
    },
    html: { type: 'string', description: 'Complete self-contained HTML document.' },
    icon: { type: 'string', description: 'Optional emoji icon.' },
    description: { type: 'string', description: 'Optional artifact summary.' },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'html'],
};

const artifactIdParameters = {
  type: 'object',
  additionalProperties: true,
  properties: {
    artifactId: { type: 'string', description: 'Desktop artifact id.' },
  },
  required: ['artifactId'],
};

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toolResult(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    details: value,
  };
}

function validationError(message) {
  return toolResult({ ok: false, error: 'invalid-params', message });
}

async function invokeDesktopNode(api, command, params) {
  const runtime = api?.runtime ?? {};
  const gateway = runtime.gateway ?? runtime.gatewayClient ?? api.gateway;

  if (gateway && typeof gateway.request === 'function') {
    return gateway.request('node.invoke', { command, params });
  }

  return {
    ok: false,
    error: 'desktop-node-unavailable',
    message: 'OpenClaw Gateway did not expose a node.invoke helper to this plugin runtime.',
  };
}

function registerGatewayMethods(api) {
  const methods = {
    'desktopCompanion.status': () => createStatusPayload(),
    'desktopCompanion.capabilities': () => ({
      ok: true,
      pluginId: PLUGIN_ID,
      capabilities: CAPABILITIES,
      desktopNode: {
        caps: DESKTOP_NODE_CAPS,
        commands: DESKTOP_NODE_COMMANDS,
      },
    }),
    'desktopCompanion.tasks.list': () => ({ ok: true, tasks: [] }),
    'desktopCompanion.tasks.get': (_ctx, params) => ({
      ok: false,
      error: 'not-found',
      taskId: asObject(params).taskId,
    }),
    'desktopCompanion.tasks.submitResult': (_ctx, params) => ({
      ok: true,
      accepted: true,
      taskId: asObject(params).taskId,
    }),
    'desktopCompanion.plugins.list': (_ctx, params) => runPluginListCli(params),
    'desktopCompanion.plugin.reinstall': (_ctx, params) => runCompanionPluginReinstallCli(params),
    'desktopCompanion.plugin.uninstall': (_ctx, params) => runCompanionPluginUninstallCli(params),
  };

  for (const [name, handler] of Object.entries(methods)) {
    api.registerGatewayMethod(name, handler);
  }
}

function registerArtifactTools(api) {
  api.registerTool({
    name: ARTIFACT_TOOLS[0],
    description: 'Create a rich HTML artifact in the connected OpenClaw Desktop app.',
    parameters: artifactCreateParameters,
    async execute(_id, params) {
      const args = asObject(params);
      if (typeof args.title !== 'string' || args.title.trim() === '') {
        return validationError('title is required');
      }
      if (typeof args.html !== 'string' || args.html.trim() === '') {
        return validationError('html is required');
      }

      return toolResult(await invokeDesktopNode(api, 'desktop.artifacts.create', args));
    },
  });

  api.registerTool({
    name: ARTIFACT_TOOLS[1],
    description: 'Update metadata for a Desktop artifact.',
    parameters: artifactIdParameters,
    async execute(_id, params) {
      const args = asObject(params);
      if (typeof args.artifactId !== 'string' || args.artifactId.trim() === '') {
        return validationError('artifactId is required');
      }
      return toolResult(await invokeDesktopNode(api, 'desktop.artifacts.update', args));
    },
  });

  api.registerTool({
    name: ARTIFACT_TOOLS[2],
    description: 'Append HTML to an existing Desktop artifact.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        artifactId: { type: 'string' },
        htmlChunk: { type: 'string' },
      },
      required: ['artifactId', 'htmlChunk'],
    },
    async execute(_id, params) {
      const args = asObject(params);
      if (typeof args.artifactId !== 'string' || args.artifactId.trim() === '') {
        return validationError('artifactId is required');
      }
      if (typeof args.htmlChunk !== 'string' || args.htmlChunk.trim() === '') {
        return validationError('htmlChunk is required');
      }
      return toolResult(await invokeDesktopNode(api, 'desktop.artifacts.append', args));
    },
  });

  api.registerTool({
    name: ARTIFACT_TOOLS[3],
    description: 'Open an existing Desktop artifact.',
    parameters: artifactIdParameters,
    async execute(_id, params) {
      const args = asObject(params);
      if (typeof args.artifactId !== 'string' || args.artifactId.trim() === '') {
        return validationError('artifactId is required');
      }
      return toolResult(await invokeDesktopNode(api, 'desktop.artifacts.open', args));
    },
  });
}

export default definePluginEntry({
  id: PLUGIN_ID,
  name: 'OpenClaw Desktop Companion',
  description: 'Connects OpenClaw Gateway agents to local OpenClaw Desktop capabilities.',
  register(api) {
    registerGatewayMethods(api);
    registerArtifactTools(api);
  },
});
