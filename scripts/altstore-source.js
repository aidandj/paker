// Writes an AltStore/SideStore source (altstore.json) and copies the .ipa next to it, both served by
// the Go server at https://paker.aidandj.com/. Add the source URL in SideStore to install and update Paker.
// usage: node scripts/altstore-source.js <unsigned.ipa> <version> <out-dir>
const fs = require('fs');
const path = require('path');
const [ipa, version, outDir] = process.argv.slice(2);
if (!ipa || !version || !outDir) throw new Error('usage: altstore-source.js <ipa> <version> <out-dir>');
const base = process.env.SOURCE_BASE_URL || 'https://paker.aidandj.com';
const ipaName = `paker-${version}.ipa`;
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(ipa, path.join(outDir, ipaName));
const source = {
  name: 'Paker',
  identifier: 'com.aidandj.paker.source',
  sourceURL: `${base}/altstore.json`,
  apps: [
    {
      name: 'Paker',
      bundleIdentifier: 'com.aidandj.paker',
      developerName: 'Aidan Jensen',
      subtitle: 'Packing list for trips',
      localizedDescription: 'Plan what to pack, tick things off as they go in the bag, flag what needs a refill. Syncs between your devices.',
      iconURL: `${base}/icon.png`,
      tintColor: '#2F80ED',
      versions: [
        {
          version,
          date: new Date().toISOString(),
          downloadURL: `${base}/${ipaName}`,
          size: fs.statSync(ipa).size,
          minOSVersion: '16.4',
          localizedDescription: `Paker ${version}`,
        },
      ],
      appPermissions: { entitlements: [], privacy: {} },
    },
  ],
};
fs.writeFileSync(path.join(outDir, 'altstore.json'), JSON.stringify(source, null, 2) + '\n');
console.log(`wrote ${outDir}/altstore.json and ${ipaName} (${source.apps[0].versions[0].size} bytes)`);
