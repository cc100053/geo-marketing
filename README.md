# GEO Marketing Workspace

This workspace is shared across apps. It keeps GEOFlow, SEO/GEO content
workflows, and static marketing publishing separate from any single app repo.

For the operational runbook covering all nodes, endpoints, deploy commands, and
the daily automation task, see:

- `shared/docs/multi_app_geo_marketing_runbook.md`
- `shared/docs/geoflow_content_workflow.md`
- `shared/docs/geoflow_deployment.md`

## Layout

```text
shared/
  GEOFlow/                 # Shared local GEOFlow CMS checkout
  docs/                    # Cross-app GEO/SEO workflow docs
  templates/               # Templates for onboarding new apps

projects/
  pettomo/                 # PetTomo marketing site and Firebase Hosting output
    html/
    scripts/
    docs/
    firebase.json
    .firebaserc
    deployments/GEOFlow -> ../../.. /shared/GEOFlow
  kairogu/                 # Kairogu Japanese-only Vercel static site and guide output
    html/
    scripts/
    docs/
    vercel.json
    deployments/GEOFlow -> ../../../shared/GEOFlow
```

External app source:

```text
/Users/fatboy/kurabe/       # Kairogu Flutter app repo and product facts
/Users/fatboy/kurabe/assets # Kairogu real app icons and App Store screenshots
/Users/fatboy/pet/          # PetTomo Flutter app repo and product facts
/Users/fatboy/pet/assets    # PetTomo real app icons, pets, UI assets, screenshots
```

## Operating Model

- GEOFlow is the CMS/content database.
- Each app has its own project folder under `projects/<app>/`.
- Each app owns its own static `html/`, hosting config, export script, and
  guide manifest. PetTomo currently uses Firebase Hosting; Kairogu currently
  uses Vercel.
- Shared workflow docs live under `shared/docs/`.

Default article rule:

```text
1 topic = 5 language pages = 1 hreflang group
```

Supported default languages:

- `en`
- `zh-hant`
- `zh-hans`
- `ja`
- `ko`

## PetTomo Commands

From `projects/pettomo`:

```sh
docker compose up -d --no-build
node scripts/export_geoflow_guides.mjs
FIREBASE_CLI_DISABLE_UPDATE_CHECK=true firebase deploy --only hosting --project pet-app-702be --non-interactive
```

Live endpoints:

- `https://pet-app-702be.web.app/`
- `https://pet-app-702be.web.app/index_en.html`
- `https://pet-app-702be.web.app/index_ja.html`
- `https://pet-app-702be.web.app/index_ko.html`
- `https://pet-app-702be.web.app/guides/`
- `https://pet-app-702be.web.app/guides/en/`
- `https://pet-app-702be.web.app/guides/zh-hant/`
- `https://pet-app-702be.web.app/guides/zh-hans/`
- `https://pet-app-702be.web.app/guides/ja/`
- `https://pet-app-702be.web.app/guides/ko/`
- `https://pet-app-702be.web.app/sitemap.xml`

Last verified after Firebase Hosting deploy: 2026-05-10.

## Kairogu Commands

From `projects/kairogu`:

```sh
node scripts/export_geoflow_guides.mjs
git add html/
git commit -m "update guides and sitemap"
git push
```

Vercel auto-deploys on push via Git integration. No manual `vercel deploy` needed.

Kairogu is Japan-only for now:

- Content language: `ja`
- Public site: `https://www.kairogu.men/`
- Hosting: Vercel
- Guide index: `https://www.kairogu.men/guides/`
- First staged article: `docs/articles/price-recording-app-ja.md`
- Vercel production project: `kurabe`
- Git repo: `cc100053/geo-marketing`, root `projects/kairogu`
- Vercel serves `html/` directly (`buildCommand: null`)

Live endpoints:

- `https://www.kairogu.men/`
- `https://www.kairogu.men/guides/`
- `https://www.kairogu.men/guides/ja/`
- `https://www.kairogu.men/sitemap.xml`
- `https://www.kairogu.men/guides/ja/price-recording-app.html`
- `https://www.kairogu.men/guides/ja/price-tag-reading.html`
- `https://www.kairogu.men/guides/ja/receipt-vs-price-recording.html`

Last verified after Vercel Git deploy: 2026-05-10.

Current Vercel production project:

- Project: `kurabe`
- Custom domain: `www.kairogu.men`
- Git integration: `cc100053/geo-marketing`, root directory `projects/kairogu`
- `vercel.json` sets `buildCommand: null`; Vercel serves the committed `html/`
  folder directly. The export script requires local Docker/GEOFlow and cannot
  run on Vercel CI.

## Daily Automation

- ID: `daily-pettomo-geo-and-seo-marketing`
- Config: `/Users/fatboy/.codex/automations/daily-pettomo-geo-and-seo-marketing/automation.toml`
- Schedule: daily at 09:00
- Scope: PetTomo multilingual GEO/SEO plus one Japanese Kairogu article when
  feasible.
- Memory: `/Users/fatboy/.codex/automations/daily-pettomo-geo-and-seo-marketing/memory.md`

## Adding Another App

1. Create `projects/<app>/`.
2. Add that app's `html/` and the correct hosting config for that app
   (`firebase.json` / `.firebaserc` for Firebase, `vercel.json` for Vercel).
3. Copy or adapt the export script.
4. Create `scripts/geoflow_guides_manifest.json`.
5. Add app-specific content facts and claims to avoid.
6. Follow `shared/docs/geoflow_content_workflow.md`.
