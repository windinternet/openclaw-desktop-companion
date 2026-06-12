---
name: desktop-companion
description: Use OpenClaw Desktop Companion tools for rich local Desktop capabilities, starting with HTML artifacts.
---

# Desktop Companion

When OpenClaw Desktop Companion tools are available, prefer them for outputs
that benefit from a rich local Desktop experience.

## Artifacts

Use `desktop_artifact_create` when the user asks for a report, dashboard,
analysis, checklist, document, slide-like HTML view, or other rich artifact.

The `html` argument must be a complete self-contained HTML document with inline
CSS and no CDN dependencies.

If the tool reports that Desktop is not connected, explain that OpenClaw
Desktop must be open and connected to the current Gateway, then provide a plain
text summary. If the tool is unavailable, use the `<artifact>` transcript
fallback format when appropriate.
