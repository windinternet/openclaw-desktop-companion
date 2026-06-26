# OpenClaw Desktop Companion

Native OpenClaw plugin for connecting Gateway agents to local OpenClaw Desktop
capabilities.

## Install

```bash
openclaw plugins install git:github.com/windinternet/openclaw-desktop-companion@main
openclaw plugins enable openclaw-desktop-companion
openclaw gateway restart
openclaw plugins inspect openclaw-desktop-companion --runtime --json
```

## Capabilities

- Gateway RPC control plane under `desktopCompanion.*`
- Repository Context Provider:
  - `desktopCompanion.repositoryContext.set`
  - `desktopCompanion.repositoryContext.get`
  - `desktopCompanion.repositoryContext.clear`
  - `before_prompt_build` injection for all Gateway Agents
- Agent repository tools:
  - `desktop_repository_status`
  - `desktop_repository_read`
  - `desktop_repository_search`
  - `desktop_repository_write`
  - `desktop_repository_git_status`
  - `desktop_repository_git_diff`
  - `desktop_repository_git_log`
  - `desktop_repository_git_commit`
- Agent output tools:
  - `desktop_outputs_create`
  - `desktop_outputs_open`
  - `desktop_outputs_update`
  - `desktop_outputs_append`
- Agent artifact compatibility tools:
  - `desktop_artifact_create`
  - `desktop_artifact_update`
  - `desktop_artifact_append`
  - `desktop_artifact_open`
- Explicit `<artifact>` observer for session outputs

## Desktop Node Execution Bridge

The Companion plugin is the Gateway-side coordination layer. It does not access
the user's local filesystem or Desktop process directly.

OpenClaw Desktop connects to the same Gateway as an official Gateway node and
declares the local execution capabilities it can handle. This is the bridge that
lets a remote Gateway safely ask the user's Desktop app to execute structured
local commands.

Runtime flow:

1. A Gateway Agent calls a Companion tool, such as `desktop_repository_read`.
2. The plugin validates the tool payload and forwards it through Gateway
   `node.invoke`.
3. OpenClaw Desktop receives the `node.invoke.request` as the connected Desktop
   node.
4. Desktop executes the local command, such as `desktop.repository.read` or
   `desktop.outputs.create`, and returns a structured `node.invoke.result`.

The plugin advertises the Desktop node capabilities it expects through
`desktopCompanion.status` / `desktopCompanion.capabilities`:

- Required Desktop node caps:
  - `desktop`
  - `desktop.artifacts`
  - `desktop.repository`
  - `desktop.outputs`
- Required Desktop node commands:
  - `desktop.artifacts.create`
  - `desktop.artifacts.open`
  - `desktop.artifacts.update`
  - `desktop.artifacts.append`
  - `desktop.repository.status`
  - `desktop.repository.init`
  - `desktop.repository.read`
  - `desktop.repository.write`
  - `desktop.repository.search`
  - `desktop.repository.git.status`
  - `desktop.repository.git.diff`
  - `desktop.repository.git.log`
  - `desktop.repository.git.commit`
  - `desktop.repository.session-summary.write`
  - `desktop.outputs.create`
  - `desktop.outputs.open`
  - `desktop.outputs.update`
  - `desktop.outputs.append`
  - `desktop.notify`

This separation keeps Gateway-side Agent tools portable while keeping local
filesystem, Git, preview, and output execution inside OpenClaw Desktop.

## Development

```bash
npm test
```
