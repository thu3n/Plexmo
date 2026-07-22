#!/bin/sh
set -e

# Defaults
PUID=${PUID:-1001}
PGID=${PGID:-1001}

echo "Starting with PUID=${PUID} and PGID=${PGID}"

# Modify user/group IDs if they don't match (logic adapted from linuxserver.io)
# The group is 'nodejs' as defined in Dockerfile
CUR_UID=$(id -u nextjs)
CUR_GID=$(getent group nodejs | cut -d: -f3)

if [ "$PUID" != "$CUR_UID" ]; then
    echo "Switching nextjs user UID from $CUR_UID to $PUID"
    usermod -o -u "$PUID" nextjs
fi

if [ "$PGID" != "$CUR_GID" ]; then
    echo "Switching nodejs group GID from $CUR_GID to $PGID"
    groupmod -o -g "$PGID" nodejs
fi

# Ensure nextjs user is in the nodejs group
usermod -g nodejs nextjs

# Ensure config directory exists and has correct permissions
mkdir -p /app/config
echo "Ensuring permissions on /app/config..."
chown -R nextjs:nodejs /app/config

# Also ensure local database directory has permissions if falling back to it
if [ -d "/app/prisma" ]; then
    chown -R nextjs:nodejs /app/prisma
fi
if [ -d "/app/.next" ]; then
    chown -R nextjs:nodejs /app/.next
fi

echo "Permissions set. Starting application..."

# Exec the passed command (CMD from Dockerfile) as the nextjs user
exec gosu nextjs "$@"
