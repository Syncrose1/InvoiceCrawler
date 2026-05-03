# Invoice Crawler

> A [Syncratic](https://github.com/Syncrose1) product.

AI-powered invoice data extraction for accountancy firms. Drop a folder of invoice images or PDFs, get a clean CSV of structured data — dates, totals, VAT, company names, and any other fields you configure.

Built with TypeScript, Electron, and modern vision APIs (Anthropic Claude or OpenAI).

## Why a rebuild?

This is V2 of a tool originally built in 2023 for an accountancy firm. The original used Tesseract OCR + GPT text-davinci-003 with a custom multi-agent writer/editor pattern to compensate for unreliable structured output. Modern vision APIs and JSON schema enforcement collapse that entire pipeline into a single API call per invoice — cheaper, faster, and far more accurate.

## Features

- **Vision-based extraction** — no OCR, no Tesseract, no Poppler. Invoice images go straight to a multimodal LLM
- **Multi-language out of the box** — vision APIs read any script (Latin, Arabic, CJK, Cyrillic, etc.) with no per-language setup
- **Cost-efficient** — defaults to Haiku 4.5 / GPT-4o-mini (~$1–3 per 1,000 invoices). One API call per invoice
- **Configurable fields** — add, remove, and reorder extraction fields through the UI. Each field can have synonyms and formatting hints
- **Firm profiles** — each firm saves its own preset of fields, AI provider, model, and API key
- **Editable results** — review and correct extracted data in a table before exporting CSV
- **Batch processing** — concurrent processing with live progress and cancellation
- **Local-first** — all profiles and data stay on your machine. API keys are encrypted via the OS keychain

## Requirements

- **Node.js** 20+ (for development)
- **An API key** from either:
  - [Anthropic](https://console.anthropic.com/) (Claude)
  - [OpenAI](https://platform.openai.com/)

## Setup (development)

```bash
git clone https://github.com/Syncrose1/InvoiceCrawler.git
cd InvoiceCrawler/invoice-crawler
npm install
npm run dev
```

The Electron window will open automatically. Hot-reload is enabled for the renderer; main process changes require restarting `npm run dev`.

## Build a distributable locally

```bash
# All platforms (uses your current OS)
npm run package

# Specific platforms
npm run package:win
npm run package:mac
npm run package:linux
```

Built installers land in `invoice-crawler/dist/`.

## Releasing a new version

Releases are built and published automatically by GitHub Actions when you push a `v*` tag.

```bash
# 1. Bump the version in invoice-crawler/package.json (semver — e.g. 2.0.0 -> 2.0.1)
# 2. Commit and push
git add invoice-crawler/package.json
git commit -m "Release v2.0.1"
git push

# 3. Tag and push the tag
git tag v2.0.1
git push --tags
```

That tag push triggers `.github/workflows/release.yml`, which:

1. Builds the app on `ubuntu-latest`, `macos-latest`, and `windows-latest` in parallel
2. Each runner uploads its installer (`.AppImage`, `.dmg`, `.exe`) and the matching `electron-updater` metadata file (`latest-linux.yml`, `latest-mac.yml`, `latest.yml`) to a **draft** GitHub Release named after the tag
3. Once all three OSes succeed, a final job promotes the draft to a public release
4. Existing installs running an older version pick up the update within ~4 hours via electron-updater (or on next launch)

A guard step also fails fast if the tag and `package.json` version don't match — no half-misnumbered releases.

> The `GITHUB_TOKEN` provided to workflows is sufficient — no Personal Access Token needed.

### macOS caveat

macOS builds are currently **unsigned and un-notarized**. Two things to know:

1. **First launch will trigger Gatekeeper** — the user has to right-click → Open the first time, or run `xattr -cr "/Applications/Invoice Crawler.app"` after installing.
2. **Auto-updates won't apply on macOS** until the app is signed with an Apple Developer ID certificate (~£75/yr from Apple). electron-updater silently fails to swap an unsigned app in place. Mac users will need to manually download new versions from GitHub Releases. Linux (AppImage) and Windows (NSIS) auto-updates work fine without signing.

When ready to sign for macOS, add an `Apple Developer ID Application` certificate to GitHub Actions secrets (`CSC_LINK` + `CSC_KEY_PASSWORD`) and notarisation creds (`APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`). electron-builder picks them up automatically.

## Project structure

```
invoice-crawler/
├── src/
│   ├── main/              # Electron main process (Node.js)
│   │   ├── index.ts       # App entry, window creation
│   │   ├── ipc.ts         # IPC handler registration
│   │   └── services/      # File scanning, AI providers, batch processing, CSV export
│   ├── preload/           # Context bridge between main and renderer
│   ├── renderer/          # React UI
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── pages/     # HomePage, SettingsPage, FieldEditorPage, etc.
│   │       ├── components/
│   │       └── hooks/
│   └── shared/            # Types and constants used by both processes
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.{json,node.json,web.json}
└── package.json
```

## Architecture notes

**Process split**: The main process handles all file I/O, PDF conversion, and AI API calls. The renderer is a sandboxed React UI that talks to main exclusively via typed IPC. API keys never leave the main process.

**IPC**: Every channel is defined once in `src/shared/types.ts`. The `handle<C>()` helper in `main/ipc.ts` and `ipcInvoke<C>()` in the renderer both infer args and return types from the channel name — type safety end-to-end.

**AI providers**: An `AiProvider` interface abstracts over Anthropic and OpenAI. Vision API + structured JSON output means one call per invoice. Multi-page PDFs are sent as multiple images in the same message. Anthropic uses `output_config.format` with a JSON schema; OpenAI uses `response_format: json_schema` with `strict: true`.

**Profiles**: Stored as JSON files in the OS app-data directory (`~/.config/invoice-crawler/` on Linux, `%APPDATA%/invoice-crawler/` on Windows, `~/Library/Application Support/invoice-crawler/` on macOS). API keys are encrypted via Electron's `safeStorage` (uses the OS keychain).

**PDF conversion**: `pdf-to-img` (pure JS, no native binaries). Each page becomes a separate image at 2x scale.

## Default extraction fields

The app ships with sensible defaults inherited from V1.4, ready to use as-is or customise per firm:

| Field | Synonyms | Hint |
|---|---|---|
| Invoice Date | date received, billing date, issue date | Format as DD/MM/YYYY |
| Invoice Number | invoice no, invoice #, reference | — |
| Company Name | organisation, firm name, supplier, vendor | — |
| Total | gross total, gross amount, amount due, total amount | Numeric only, no currency symbol |
| VAT | tax, tax amount, gst | Numeric only, no currency symbol |

## Status

Phase 1 (scaffold) is complete. See commit history for progress on subsequent phases:

- ✅ Phase 1 — Electron + React skeleton, dark theme, IPC infrastructure
- 🚧 Phase 2 — AI provider implementations (Anthropic + OpenAI)
- ⏳ Phase 3 — Profile storage and field editor UI
- ⏳ Phase 4 — Batch processing with concurrency and progress
- ⏳ Phase 5 — Editable results table and CSV export
- ⏳ Phase 6 — Polish, animations, packaging

## License

MIT

---

Kind Regards,
Syncratic.
