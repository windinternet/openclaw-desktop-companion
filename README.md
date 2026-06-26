# OpenClaw Desktop Companion

[English](README.en.md)

OpenClaw 原生插件，用于把 Gateway Agent runtime 连接到用户本机的
OpenClaw Desktop 能力。

它的定位不是单一产物插件，而是 OpenClaw Desktop 与 OpenClaw Gateway
之间的运行时协作层：插件运行在 Gateway 侧，负责上下文注入、Agent 工具
注册、会话产物观察与 `node.invoke` 转发；OpenClaw Desktop 作为 Gateway
node 连接同一个 Gateway，负责真正执行本机文件、Git、预览和产物输出等结构化命令。

## 安装

```bash
openclaw plugins install git:github.com/windinternet/openclaw-desktop-companion@main
openclaw plugins enable openclaw-desktop-companion
openclaw gateway restart
openclaw plugins inspect openclaw-desktop-companion --runtime --json
```

## 能力

- Gateway RPC 控制面：`desktopCompanion.*`
- Repository Context Provider：
  - `desktopCompanion.repositoryContext.set`
  - `desktopCompanion.repositoryContext.get`
  - `desktopCompanion.repositoryContext.clear`
  - 通过 `before_prompt_build` 为所有 Gateway Agent 注入绑定仓库上下文
- Agent repository tools：
  - `desktop_repository_status`
  - `desktop_repository_read`
  - `desktop_repository_search`
  - `desktop_repository_write`
  - `desktop_repository_git_status`
  - `desktop_repository_git_diff`
  - `desktop_repository_git_log`
  - `desktop_repository_git_commit`
- Agent output tools：
  - `desktop_outputs_create`
  - `desktop_outputs_open`
  - `desktop_outputs_update`
  - `desktop_outputs_append`
- Agent artifact 兼容工具：
  - `desktop_artifact_create`
  - `desktop_artifact_update`
  - `desktop_artifact_append`
  - `desktop_artifact_open`
- 显式 `<artifact>` 会话产物观察器

## Desktop Node 执行桥

Companion 插件是 Gateway 侧协调层。它不会直接访问用户本机文件系统或
Desktop 进程。

OpenClaw Desktop 会连接到同一个 Gateway，并作为官方 Gateway node 声明
自己可执行的本机能力。这个执行桥让远程 Gateway 能够安全地请求用户本机
Desktop 执行结构化命令。

运行时流程：

1. Gateway Agent 调用 Companion 工具，例如 `desktop_repository_read`。
2. 插件校验工具 payload，并通过 Gateway `node.invoke` 转发请求。
3. OpenClaw Desktop 作为已连接的 Desktop node 接收 `node.invoke.request`。
4. Desktop 执行本机命令，例如 `desktop.repository.read` 或
   `desktop.outputs.create`，并返回结构化 `node.invoke.result`。

插件会通过 `desktopCompanion.status` / `desktopCompanion.capabilities`
声明它期望 Desktop node 提供的能力。

Required Desktop node caps：

- `desktop`
- `desktop.artifacts`
- `desktop.repository`
- `desktop.outputs`

Required Desktop node commands：

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

这种分层让 Gateway 侧 Agent tools 保持可移植，同时把本机文件系统、Git、预览、
产物输出等执行动作保留在 OpenClaw Desktop 内部。

## 开发

```bash
npm test
```
