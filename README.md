# OpenClaw Desktop Companion

Native OpenClaw plugin for connecting Gateway agents to local OpenClaw Desktop
capabilities. The first capability is rich HTML artifacts.

## Install

```bash
openclaw plugins install git:github.com/windinternet/openclaw-desktop-companion@main
openclaw plugins enable openclaw-desktop-companion
openclaw gateway restart
openclaw plugins inspect openclaw-desktop-companion --runtime --json
```

## Capabilities

- Gateway RPC control plane under `desktopCompanion.*`
- Agent artifact tools:
  - `desktop_artifact_create`
  - `desktop_artifact_update`
  - `desktop_artifact_append`
  - `desktop_artifact_open`
- Desktop execution through official Gateway node commands such as
  `desktop.artifacts.create`

## Development

```bash
npm test
```
