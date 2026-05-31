# Josh Health Analyser

A personal health data analysis app powered by Claude AI. Upload wearable exports, pathology reports, and health CSVs for deep AI-powered insights.

> ⚕️ **Not medical advice** — for personal reflection only.

## Features

- **Upload anything**: CSV, PDF, JSON, ZIP archives, SQLite .db (Health Connect), plain text
- **9 analysis modes**: Quick summary, deep patterns, clinical review, sleep, movement, HRV/recovery, nutrition, 90-day action plan, period comparison
- **Streaming AI analysis** via Claude claude-opus-4-5
- **Follow-up chat**: Ask questions about your data after analysis
- **Download results** as markdown
- **API key stored locally** — never leaves your browser

## Deploy on Vercel (recommended)

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Framework: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy — done.

## Deploy on GitHub Pages

```bash
npm run build
# Then use gh-pages branch or GitHub Actions to serve /dist
```

Or add to `vite.config.js`:
```js
base: '/your-repo-name/'
```

## Local Development

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## How to use

1. Enter your [Anthropic API key](https://console.anthropic.com/settings/keys)
2. Upload health data files
3. Select analysis modes
4. Click Analyse
5. Read results, ask follow-up questions in chat

## Supported file types

| Type | Use case |
|------|----------|
| `.db` | Health Connect SQLite export |
| `.csv` | Fitbit, Garmin, wearable exports |
| `.pdf` | Pathology reports, blood tests |
| `.zip` | Withings, Garmin bulk exports |
| `.json` | App exports (Oura, etc.) |
| `.txt/.md` | Notes, reports |

## Tech stack

- React 18 + Vite
- Tailwind CSS
- Anthropic Claude API (streaming)
- sql.js (SQLite in-browser)
- JSZip (ZIP parsing)
- pdfjs-dist (PDF text extraction)
- react-dropzone
- react-markdown
- Recharts (ready for chart extensions)

## Privacy

- All file parsing happens in your browser
- Only extracted text summaries are sent to Anthropic's API
- API key stored in localStorage — clear browser data to remove it
- No backend, no tracking, no data storage

## Automation: GitHub Actions

This repository includes two GitHub Actions workflows to help automate CI and optional doc formatting:

- `.github/workflows/ci.yml` — runs on `push` and `pull_request`, installing dependencies and running lint/test/build steps.
- `.github/workflows/dispatch-apply.yml` — a manually-triggered workflow (`workflow_dispatch`) that runs `.github/scripts/apply_changes.sh` to format docs and commit changes back to `main` when there are updates.

Security notes:

- I cannot use or accept Personal Access Tokens pasted into chat. Do not post secrets here.
- To allow the `dispatch-apply` workflow to push commits, the built-in `GITHUB_TOKEN` is sufficient for commits within the repository. If you need cross-repo access or other scopes, create a fine-scoped PAT and add it to repository secrets as `ACTIONS_PAT`.

To run the manual workflow after you push these files, go to the repository Actions tab, open "Apply Changes (manual)" and click "Run workflow".


## Planned improvements & roadmap

See the full list of proposed improvements and next steps in `docs/improvements.md`.

Key priorities:

- Automated Health Connect importer (first implementation)
- Import preview and history UI
- Privacy controls and encrypted local backups

