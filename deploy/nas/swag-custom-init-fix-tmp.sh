#!/bin/bash
# Optional, for SWAG as a whole (camux etc.): nginx workers run as "abc" but /var/lib/nginx/tmp is
# root-owned in this image, so spooled request bodies and large proxied responses fail with
# "Permission denied" (500s, truncated downloads). Install once and it re-applies on every start:
#   sudo cp /tmp/paker/deploy/nas/swag-custom-init-fix-tmp.sh /volume1/docker/certbot/custom-cont-init.d/10-fix-nginx-tmp.sh
#   sudo chmod +x /volume1/docker/certbot/custom-cont-init.d/10-fix-nginx-tmp.sh
#   sudo docker restart linuxserver-swag-compose
chown -R abc:abc /var/lib/nginx/tmp 2>/dev/null || true
