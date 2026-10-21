#!/bin/sh
# Deploys the AltServer stack on the Synology NAS. Run as root:
#   sudo sh /tmp/paker/deploy/nas/deploy-altserver.sh
# Before: run deploy-anisette.sh, and run deploy/mac/pair-iphone.sh on the Mac (it fills ./lockdown).
set -eu
SRC=$(cd "$(dirname "$0")" && pwd)
DEST=/volume2/docker-composes/altserver

echo "== compose -> $DEST"
mkdir -p "$DEST/lockdown"
cp "$SRC/altserver/docker-compose.yml" "$DEST/docker-compose.yml"
[ -f "$DEST/.env" ] || { cp "$SRC/altserver/.env.example" "$DEST/.env"; chmod 600 "$DEST/.env"; echo "   created $DEST/.env - fill in ALTSERVER_APPLE_ID / PASSWORD / UDID"; }
if [ -d /tmp/paker/lockdown ]; then cp /tmp/paker/lockdown/*.plist "$DEST/lockdown/"; echo "   copied pairing record(s) from /tmp/paker/lockdown"; fi
ls -l "$DEST/lockdown" | grep -q plist || { echo "!! no pairing record in $DEST/lockdown yet; run deploy/mac/pair-iphone.sh first"; exit 1; }

echo "== anisette must be up (deploy-anisette.sh)"
curl -s -m 10 http://127.0.0.1:6969/ | grep -q "X-Apple" || { echo "!! anisette not answering on 127.0.0.1:6969"; exit 1; }

cd "$DEST" && docker-compose pull && docker-compose up -d
echo "== status page: http://$(hostname -I 2>/dev/null | awk '{print $1}'):8099  (LAN only)"
echo "   then http://<nas>:8099/install to sign in with the Apple ID and install AltStore on the phone"
