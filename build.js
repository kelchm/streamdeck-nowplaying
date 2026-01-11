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

// Copy renderer.js to bin directory
fs.copyFileSync(
  path.join(__dirname, 'src', 'renderer.js'),
  path.join(binDir, 'renderer.js')
);

// Copy layouts directory if it exists
const layoutsDir = path.join(__dirname, 'layouts');
const destLayoutsDir = path.join(__dirname, 'layouts');
// Layouts are in the root, no need to copy - they'll be deployed as-is

console.log('Build complete! Plugin ready in bin/');
