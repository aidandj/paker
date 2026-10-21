#!/bin/sh
# One-time: copy this Mac's iPhone pairing record to the NAS so netmuxd/AltServer can talk to the
# phone over Wi-Fi. Plug the iPhone in, unlock it, tap Trust, then:  sudo sh deploy/mac/pair-iphone.sh
# Also enable "Show this iPhone when on Wi-Fi" in Finder for the phone, or it will not advertise itself.
set -eu
NAS=${NAS:-aidandj@10.10.0.94}
[ "$(id -u)" = 0 ] || { echo "run with sudo (pairing records are root-only)"; exit 1; }
UDID=$(xcrun devicectl list devices 2>/dev/null | awk '/connected/ && /[0-9A-F-]{25,}/ {for(i=1;i<=NF;i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) print $i}' | head -1)
[ -n "$UDID" ] || UDID=$(ls /var/db/lockdown/ | grep -E '^[0-9A-F]{8}-[0-9A-F]{16}\.plist$' | sed 's/\.plist$//' | head -1)
[ -n "$UDID" ] || { echo "no iPhone pairing record found in /var/db/lockdown (plug in, unlock, tap Trust)"; exit 1; }
echo "UDID: $UDID"
TMP=$(mktemp -d); mkdir "$TMP/lockdown"
cp "/var/db/lockdown/$UDID.plist" "$TMP/lockdown/"
cp /var/db/lockdown/SystemConfiguration.plist "$TMP/lockdown/" 2>/dev/null || true
chmod 644 "$TMP/lockdown/"*
SUDO_USER=${SUDO_USER:-$(whoami)}
tar czf - -C "$TMP" lockdown | su "$SUDO_USER" -c "ssh $NAS 'mkdir -p /tmp/paker && tar xzf - -C /tmp/paker'"
rm -rf "$TMP"
echo "copied to $NAS:/tmp/paker/lockdown/. Put ALTSERVER_UDID=$UDID in /volume2/docker-composes/altserver/.env, then run deploy-altserver.sh on the NAS."
