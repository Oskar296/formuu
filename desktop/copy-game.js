// Bundle the web game into the desktop app: copies ../public/game → ./game.
// Run before `npm start` or a build so the shell always ships the current game.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'public', 'game');
const dest = path.join(__dirname, 'game');

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log('game files copied →', dest);
