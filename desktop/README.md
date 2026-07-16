# THE EXAM — desktop app

A downloadable desktop version of the game (like a normal PC game), built with
Electron. The shell serves the exact same game as the web version from an
internal localhost server, so multiplayer, friends, accounts and stats all work
identically — no separate codebase.

## Download

Installers are built by CI (`.github/workflows/desktop.yml`):

- **Get a build now:** GitHub → Actions → *Desktop builds* → *Run workflow*,
  then download the artifact for your OS.
- **Publish a release:** push a tag like `v0.1.0` — installers for Windows
  (`.exe`), macOS (`.dmg`) and Linux (`.AppImage`) are attached to the GitHub
  Release automatically. Share that release link as the game's download page.

## Run from source

```bash
cd desktop
npm install
npm start      # copies ../public/game into the shell and launches
```

## Build installers locally

```bash
cd desktop
npm install
npm run dist   # output in desktop/dist/
```

Notes:
- Window starts maximized; **F11** toggles fullscreen.
- Game data (profile, stats, friends) is stored per-machine in the app's
  localStorage (stable localhost origin), independent of your browsers.
- This shell is also the first step toward a Steam build — Steamworks
  integration (achievements, lobbies, friends) plugs into this same wrapper.
