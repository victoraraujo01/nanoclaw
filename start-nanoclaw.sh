#!/bin/bash
# start-nanoclaw.sh — Start NanoClaw without systemd
# To stop: kill \$(cat /home/nanoclaw/nanoclaw/nanoclaw.pid)

set -euo pipefail

cd "/home/nanoclaw/nanoclaw"

# Stop existing instance if running
if [ -f "/home/nanoclaw/nanoclaw/nanoclaw.pid" ]; then
  OLD_PID=$(cat "/home/nanoclaw/nanoclaw/nanoclaw.pid" 2>/dev/null || echo "")
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping existing NanoClaw (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 2
  fi
fi

# Sync custom skills from nanoclaw-skills repo
SKILLS_REPO="https://github.com/victoraraujo01/nanoclaw-skills.git"
SKILLS_CACHE="/home/nanoclaw/nanoclaw-skills"
SESSIONS_DIR="/home/nanoclaw/nanoclaw/data/sessions"

echo "Syncing custom skills..."
if [ -d "$SKILLS_CACHE/.git" ]; then
  git -C "$SKILLS_CACHE" pull --ff-only 2>/dev/null || echo "Skills sync failed (offline?), using cached version"
else
  git clone "$SKILLS_REPO" "$SKILLS_CACHE" || echo "Skills clone failed, skipping"
fi

if [ -d "$SKILLS_CACHE" ]; then
  for session_dir in "$SESSIONS_DIR"/*/; do
    skills_dir="$session_dir/.claude/skills"
    if [ -d "$skills_dir" ]; then
      rsync -a --exclude='.git' "$SKILLS_CACHE/" "$skills_dir/" 2>/dev/null || true
    fi
  done
  echo "Skills synced to $(ls "$SESSIONS_DIR" | wc -l) sessions"
fi

echo "Starting NanoClaw..."
nohup "/usr/bin/node" "/home/nanoclaw/nanoclaw/dist/index.js" \
  >> "/home/nanoclaw/nanoclaw/logs/nanoclaw.log" \
  2>> "/home/nanoclaw/nanoclaw/logs/nanoclaw.error.log" &

echo $! > "/home/nanoclaw/nanoclaw/nanoclaw.pid"
echo "NanoClaw started (PID $!)"
echo "Logs: tail -f /home/nanoclaw/nanoclaw/logs/nanoclaw.log"
