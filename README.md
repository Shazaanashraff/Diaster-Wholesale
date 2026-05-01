# Diaster Wholesale Desktop (Electron)

This project runs as a desktop app using Electron + Vite + React, with:

- Electron runtime (main + preload process)
- electron-builder packaging
- NSIS custom installer setup
- electron-updater integration

## Development

Install dependencies:

```bash
npm install
```

Run desktop app in dev mode (Vite + Electron together):

```bash
npm run dev
```

## Build Commands

Build renderer only:

```bash
npm run build
```

Create desktop installer artifacts locally (no publish):

```bash
npm run dist:win
```

Artifacts are generated in the `release/` folder:

- `Diaster Wholesale-Setup-<version>.exe`
- `latest.yml`
- `*.blockmap`

## Custom Installer Setup

NSIS behavior is configured in `package.json` (`build.nsis`) and includes:

- `oneClick: false`
- `allowToChangeInstallationDirectory: true`
- desktop/start menu shortcuts
- run app after install
- custom NSIS script: `build/nsis-custom.nsh`

The custom NSIS script stores and reuses the previous install directory.

## Auto Updates (electron-updater)

Auto update is initialized from Electron main process in `electron/main.mjs`.

Current publish provider is GitHub Releases in `package.json`:

```json
"publish": [
  {
    "provider": "github",
    "owner": "Hesara2003",
    "repo": "Diaster-Wholesale",
    "releaseType": "release"
  }
]
```

Update behavior:

1. App checks for updates on startup.
2. App checks again in the background every 15 minutes.
3. If a newer tagged release exists, installer is downloaded in the background.
4. When download completes, user is prompted to restart and install.

For private release feeds, provide a token via environment variable at runtime (never hardcode in source):

```bash
DIASTER_UPDATER_TOKEN=your_token_here
```

Before using updates in production:

1. Publish each new version as a GitHub Release with assets (`latest.yml`, setup `.exe`, `.blockmap`).
2. Bump app version in `package.json` for each release.
3. Keep secrets in CI/environment variables only (`GH_TOKEN`/`DIASTER_UPDATER_TOKEN`).

Windows setup artifact name is fixed to:

`Diaster.Wholesale-Setup-<version>.exe`
