# PortCo AI Roadmap — Prototype

A private-equity value-creation tool. Two modes:

- **Value Creation** — evaluate portfolio companies you already own, identify AI-enabled EBITDA opportunities, and roll up to a firm-level enterprise-value creation report.
- **Diligence** — score prospective acquisition targets on AI readiness across six dimensions and produce a pre-close scorecard.

Single-file static app. All state persists to the visitor's browser (localStorage). No backend.

## Live AI generation

The "Suggest with AI" button uses the visitor's own Anthropic API key (entered in Settings, stored in their browser only — never sent anywhere else). Without a key, the button falls back to sector-keyed sample suggestions.

## Deploy to Vercel via GitHub

1. Create a new GitHub repo — e.g. `portco-ai-roadmap`.
2. Put `index.html` in the root of the repo and push.
3. In Vercel: **Add New Project** → import the repo → keep all defaults (Vercel auto-detects it as a static site) → **Deploy**.
4. You'll get a URL like `portco-ai-roadmap.vercel.app` in about 30 seconds.

To update: edit `index.html`, commit, push. Vercel redeploys automatically.

## Local testing

Just double-click `index.html`. It opens in any browser. No build step.

## What's in this folder for you

- `index.html` — the app (this is the only file the repo needs)
- `PortCo-README.md` — this file (rename to `README.md` in your repo if you want it on the GitHub page)
