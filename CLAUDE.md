# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A GEO/SEO marketing workspace, not a product app repo. It manages multilingual static marketing sites for two apps:

- **PetTomo** — deployed to Firebase Hosting (`https://pet-app-702be.web.app`)
- **Kairogu** — deployed to Vercel project `kurabe` (`https://www.kairogu.men`)

App runtime code lives in separate repos (`/Users/fatboy/pet` and `/Users/fatboy/kurabe`). This repo only handles content operations, static HTML output, and hosting configs.

## Commands

### GEOFlow CMS (required before export)

Run from `shared/GEOFlow`:

```sh
docker compose up -d --no-build   # start local CMS; use --no-build for normal restarts
docker compose ps
docker compose logs --tail=120 app
```

Local endpoints: `http://127.0.0.1:18080` (app), `http://127.0.0.1:18080/geo_admin/login` (admin)

### PetTomo

Run from `projects/pettomo`:

```sh
node --check scripts/export_geoflow_guides.mjs   # syntax check before running
node scripts/export_geoflow_guides.mjs
FIREBASE_CLI_DISABLE_UPDATE_CHECK=true firebase deploy --only hosting --project pet-app-702be --non-interactive
curl -I https://pet-app-702be.web.app/guides/
```

### Kairogu

Run from `projects/kairogu`:

```sh
node --check scripts/export_geoflow_guides.mjs
node scripts/export_geoflow_guides.mjs
git add docs/articles/ scripts/geoflow_guides_manifest.json html/
git commit -m "update Kairogu guides"
git push   # Vercel auto-deploys on push — do NOT use vercel deploy --prod
curl -I https://www.kairogu.men/guides/
```

**Do not use `vercel deploy --prod`** for Kairogu. The Vercel project root is already `projects/kairogu`; CLI deploys from the wrong directory can bind to the wrong project. The safe path is always commit + push.

### Export without Docker

```sh
node scripts/export_geoflow_guides.mjs --articles-json=path/to/articles.json
node scripts/export_geoflow_guides.mjs --write-snapshot=tmp/geoflow_articles.json
```

## Architecture

```
shared/GEOFlow/          # Local GEOFlow CMS (Laravel + Docker Compose)
shared/docs/             # Cross-app operational runbooks
projects/pettomo/
  html/                  # Static output — committed and deployed as-is
  scripts/export_geoflow_guides.mjs
  scripts/geoflow_guides_manifest.json
  firebase.json / .firebaserc
projects/kairogu/
  html/                  # Static output — Vercel serves this folder directly
  scripts/export_geoflow_guides.mjs
  scripts/geoflow_guides_manifest.json
  vercel.json            # buildCommand: null, outputDirectory: html
```

The export script reads articles from GEOFlow via the Docker-hosted API, resolves them against `geoflow_guides_manifest.json`, and writes static HTML into `html/guides/`, plus `html/sitemap.xml` and `html/robots.txt`.

`html/guides/` is generated — never hand-edit those files. Edit GEOFlow records + the manifest, then re-export.

## Vercel Project Naming

There are two Vercel projects:

- **`kurabe`** — the production Kairogu site with `www.kairogu.men` domain. Source: `cc100053/geo-marketing`, root `projects/kairogu`.
- **`geo-marketing`** — an incidental CLI-created project. Not the production site. Do not delete without explicit approval.

## Content Rules

**PetTomo:** `1 topic = 5 language pages = 1 hreflang group`. Languages: `en`, `zh-hant`, `zh-hans`, `ja`, `ko`.

**Kairogu:** Japan-only. `1 topic = 1 Japanese page`. Use `カイログ` as the product name. Avoid unsupported claims: `必ず最安`, `絶対に節約できる`, `地域で一番安い`, `全店舗の価格がわかる`.

Before changing Kairogu app facts, read `/Users/fatboy/kurabe/AGENTS.md` and `/Users/fatboy/kurabe/docs/geoflow_kairogu_content_flow.md`.

## Real Assets

- Kairogu: `/Users/fatboy/kurabe/assets` (app icons, App Store screenshots)
- PetTomo: `/Users/fatboy/pet/assets` (app icons, pet assets, store screenshots)

## After Deploy

```sh
git diff --check          # before commit
curl -I <site>/guides/
curl -I <site>/sitemap.xml
```

[USER ACTION REQUIRED] Resubmit sitemaps in Google Search Console and request indexing for new/refreshed URLs.
