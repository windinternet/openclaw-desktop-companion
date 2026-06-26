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
- Desktop execution through Gateway node commands such as
  `desktop.repository.read` and `desktop.outputs.create`

## Development

```bash
npm test
```
