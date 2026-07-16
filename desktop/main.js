// THE EXAM — desktop shell.
// A minimal Electron main process: it serves the bundled game files from an
// in-process static server on a FIXED localhost port and opens a game window.
// Serving over http (instead of file://) keeps ES-module imports, importmaps
// and localStorage working exactly like the web build — and the fixed port
// keeps the storage origin stable so profiles/stats survive app restarts.

const { app, BrowserWindow, Menu, session } = require('electron');
const path = require('path');
const { serve } = require('./server.js');

const PORT = 24817;                       // fixed → stable localStorage origin
const ROOT = path.join(__dirname, 'game');

async function createWindow() {
  await serve(ROOT, PORT);
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    backgroundColor: '#0d1017',
    title: 'THE EXAM',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.maximize();
  // F11 toggles fullscreen like every PC game
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });
  // the game opens no external pages; block anything that tries
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadURL(`http://127.0.0.1:${PORT}/`);
}

// one instance only — a second launch focuses the existing window
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  app.whenReady().then(() => {
    // mic/camera style permission prompts are irrelevant here — deny all
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => app.quit());
}
