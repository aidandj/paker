#!/bin/sh
# Deploys Paker on the Synology NAS behind SWAG. Run as root:
#   sudo sh /tmp/paker/deploy/nas/deploy.sh
# Idempotent: re-run to pull a new image. Expects this layout next to it:
#   ../../docker-compose.yml  ../../.env.example  ./paker.subdomain.conf
set -eu

SRC=$(cd "$(dirname "$0")/../.." && pwd)
DEST=/volume2/docker-composes/paker
SWAG_CONFS=/volume1/docker/certbot/nginx/proxy-confs
SWAG=linuxserver-swag-compose
PORT=8090

echo "== compose files -> $DEST"
mkdir -p "$DEST"
cp "$SRC/docker-compose.yml" "$DEST/docker-compose.yml"
if [ ! -f "$DEST/.env" ]; then
  PASS=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | cut -c1-20)
  printf 'SYNC_USER=aidan\nSYNC_PASSWORD=%s\nPORT=%s\n' "$PASS" "$PORT" > "$DEST/.env"
  chmod 600 "$DEST/.env"
  echo "   created $DEST/.env (user aidan, password $PASS) - change it there if you like"
else
  echo "   keeping existing $DEST/.env"
fi

echo "== pull image and start"
cd "$DEST"
docker-compose pull
docker-compose up -d

echo "== SWAG proxy conf"
cp "$SRC/deploy/nas/paker.subdomain.conf" "$SWAG_CONFS/paker.subdomain.conf"
chown 911:911 "$SWAG_CONFS/paker.subdomain.conf"
docker exec "$SWAG" nginx -t
docker exec "$SWAG" nginx -s reload

echo "== checks"
sleep 2
printf 'container health: '; curl -s "http://localhost:$PORT/api/health"; echo
printf 'through swag:     '; curl -sk --resolve paker.aidandj.com:3001:127.0.0.1 "https://paker.aidandj.com:3001/api/health"; echo
echo "done. Add a DNS A record paker.aidandj.com -> your public IP (same as camux) if not done yet."
