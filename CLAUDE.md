# NanoClaw

Personal Claude assistant. See [README.md](README.md) for philosophy and setup. See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for architecture decisions.

## Quick Context

Single Node.js process with skill-based channel system. Channels (WhatsApp, Telegram, Slack, Discord, Gmail) are skills that self-register at startup. Messages route to Claude Agent SDK running in containers (Linux VMs). Each group has isolated filesystem and memory.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/registry.ts` | Channel registry (self-registration at startup) |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/config.ts` | Trigger pattern, paths, intervals |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/task-scheduler.ts` | Runs scheduled tasks |
| `src/db.ts` | SQLite operations |
| `groups/{name}/CLAUDE.md` | Per-group memory (isolated) |
| `container/skills/agent-browser.md` | Browser automation tool (available to all agents via Bash) |

## Skills

| Skill | When to Use |
|-------|-------------|
| `/setup` | First-time installation, authentication, service configuration |
| `/customize` | Adding channels, integrations, changing behavior |
| `/debug` | Container issues, logs, troubleshooting |
| `/update-nanoclaw` | Bring upstream NanoClaw updates into a customized install |
| `/qodo-pr-resolver` | Fetch and fix Qodo PR review issues interactively or in batch |
| `/get-qodo-rules` | Load org- and repo-level coding rules from Qodo before code tasks |

## Development

Run commands directly—don't tell the user to run them.

```bash
npm run dev          # Run with hot reload
npm run build        # Compile TypeScript
./container/build.sh # Rebuild agent container
```

Service management:
```bash
# macOS (launchd)
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # restart

# Linux (systemd)
systemctl --user start nanoclaw
systemctl --user stop nanoclaw
systemctl --user restart nanoclaw
```

## Troubleshooting

**WhatsApp not connecting after upgrade:** WhatsApp is now a separate channel fork, not bundled in core. Run `/add-whatsapp` (or `git remote add whatsapp https://github.com/qwibitai/nanoclaw-whatsapp.git && git fetch whatsapp main && (git merge whatsapp/main || { git checkout --theirs package-lock.json && git add package-lock.json && git merge --continue; }) && npm run build`) to install it. Existing auth credentials and groups are preserved.

## Container Build Cache

The container buildkit caches the build context aggressively. `--no-cache` alone does NOT invalidate COPY steps — the builder's volume retains stale files. To force a truly clean rebuild, prune the builder then re-run `./container/build.sh`.

## Custom Modifications to nanoclaw Core (fork: victoraraujo01/nanoclaw)

These changes were made to core nanoclaw files and **will conflict on upstream merges**. Review carefully before resolving conflicts — always prefer keeping these customizations.

### `src/channels/whatsapp.ts`
- Added `sendMedia()` method to `WhatsAppChannel`: reads file as Buffer, detects MIME type by extension (`.jpg/.png/.gif/.webp` → image, `.pdf` and others → document), sends via Baileys with caption support
- Integrated outgoing queue for `sendMedia` (same retry pattern as `sendMessage`)
- Added audio message handler: detects `audioMessage`, downloads via Baileys `downloadMediaMessage`, saves to group's `attachments/` folder, injects text hint `[Voice note: attachments/<id>.ogg]\nUse: voice-transcription attachments/<id>.ogg`

### `src/types.ts`
- Added `sendMedia?(jid: string, filePath: string, caption?: string): Promise<void>` to `Channel` interface

### `src/ipc.ts`
- Added `sendMedia` to `IpcDeps` interface
- Added handler for `data.type === 'media'` IPC messages (with group authorization check)
- ⚠️ **Known bug pending fix**: `filePath` in IPC files must be the host path. The fix (translating `/workspace/group/` → host path using `sourceGroup`) has been designed but not yet applied — implement it in the media handler before calling `deps.sendMedia()`

### `src/index.ts`
- Passes `sendMedia` in IPC deps object with safe fallback: `channel.sendMedia?.() ?? Promise.resolve()`

### `container/agent-runner/src/ipc-mcp-stdio.ts`
- Added `send_media` MCP tool (parameters: `file_path: string`, `caption?: string`) following the same pattern as `send_message`

### `container/skills/voice-transcription/`
- New core skill: `transcribe.py` (uses `faster-whisper`, model `base`, CPU, `int8`)
- Shell wrapper `voice-transcription` for skill invocation
- `SKILL.md` with usage instructions
- Requires `faster-whisper` installed in Docker image (`pip install faster-whisper`)
- Model is pre-downloaded in Docker image to avoid delay on first use
