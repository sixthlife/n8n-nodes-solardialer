// Copies the node icon next to the built nodes (n8n loads "file:solardialer.png" from there).
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'nodes', 'SolarDialer', 'solardialer.png');
const dest = path.join(__dirname, '..', 'dist', 'nodes', 'SolarDialer', 'solardialer.png');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
