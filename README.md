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

Current publish provider is a placeholder URL in `package.json`:

```json
"publish": [
  {
    "provider": "generic",
    "url": "https://example.com/updates"
  }
]
```

Before using updates in production:

1. Change `publish.url` to your real HTTPS update host.
2. Upload `latest.yml`, installer `.exe`, and `.blockmap` files from `release/`.
3. Bump app version in `package.json` for each new release.
