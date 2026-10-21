#!/bin/sh
# Deploys the anisette server on the Synology NAS behind SWAG. Run as root:
#   sudo sh /tmp/paker/deploy/nas/deploy-anisette.sh
set -eu
SRC=$(cd "$(dirname "$0")" && pwd)
DEST=/volume2/docker-composes/anisette
SWAG_CONFS=/volume1/docker/certbot/nginx/proxy-confs
SWAG=linuxserver-swag-compose

echo "== compose -> $DEST"
mkdir -p "$DEST"
cp "$SRC/anisette/docker-compose.yml" "$DEST/docker-compose.yml"
cd "$DEST" && docker-compose pull && docker-compose up -d

echo "== SWAG proxy conf"
cp "$SRC/anisette.subdomain.conf" "$SWAG_CONFS/anisette.subdomain.conf"
chown 911:911 "$SWAG_CONFS/anisette.subdomain.conf"
docker exec "$SWAG" nginx -t && docker exec "$SWAG" nginx -s reload

echo "== checks (first start downloads Apple libraries, may take a minute)"
sleep 5
printf 'container: '; curl -s -m 10 http://localhost:6969/ | head -c 120; echo
printf 'via swag:  '; curl -sk -m 10 --resolve anisette.aidandj.com:3001:127.0.0.1 https://anisette.aidandj.com:3001/ | head -c 120; echo
