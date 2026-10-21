// Stamps the release version into app.json before a native build.
// usage: node scripts/set-version.js <semver> <buildNumber>
const fs = require('fs');
const [version, build] = process.argv.slice(2);
if (!version || !build) throw new Error('usage: set-version.js <semver> <buildNumber>');
const file = 'app.json';
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
config.expo.version = version;
config.expo.android.versionCode = Number(build);
config.expo.ios.buildNumber = String(build);
fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
console.log(`app.json: version ${version}, build ${build}`);
