const fs = require('fs');
const path = require('path');

// Create bin directory if it doesn't exist
const binDir = path.join(__dirname, 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// Copy plugin.js to bin directory
fs.copyFileSync(
  path.join(__dirname, 'src', 'plugin.js'),
  path.join(binDir, 'plugin.js')
);

console.log('Build complete! Plugin ready in bin/');
