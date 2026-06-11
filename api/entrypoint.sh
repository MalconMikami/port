#!/bin/sh

# Ensure data directories exist with correct permissions
# Ignore errors for subdirs (volume mounts may not allow chown)
mkdir -p /data/sites /data/uploads 2>/dev/null || true
chown 1001:65533 /data/sites /data/uploads 2>/dev/null || true

exec "$@"
