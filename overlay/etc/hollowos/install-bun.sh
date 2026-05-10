#!/bin/sh
# HollowOS - Install bun on first boot
# Runs once via runit, then disables itself

STAMP="/var/lib/hollowos/bun-installed"

[ -f "$STAMP" ] && exit 0

mkdir -p /var/lib/hollowos

echo "[hollow] Installing bun..."
curl -fsSL https://bun.sh/install | bash -s -- --install-dir /usr/local/bin

if [ -f "/usr/local/bin/bun" ]; then
    echo "[hollow] bun installed successfully"
    touch "$STAMP"
else
    echo "[hollow] bun install failed — check network connection"
    exit 1
fi
