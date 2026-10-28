const fs = require('node:fs');
fs.mkdirSync('vendor', { recursive: true });
fs.copyFileSync('node_modules/peerjs/dist/peerjs.min.js', 'vendor/peerjs.min.js');
