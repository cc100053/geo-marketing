# Multi-App GEO Marketing Runbook

This runbook describes the operational nodes, endpoints, deployment flows, and
daily automation for the GEO marketing workspace.

## Scope

The workspace currently manages marketing content for:

- PetTomo: multilingual SEO/GEO guides, exported from GEOFlow and deployed to
  Firebase Hosting.
- Kairogu: Japan-only SEO/GEO guides, exported from GEOFlow and deployed to the
  existing Vercel project for `www.kairogu.men`.

Keep app runtime code outside this workspace. Use this workspace for GEOFlow
content operations, static marketing output, hosting configuration, and
deployment runbooks.

## Nodes

### GEOFlow CMS

- Node: shared CMS/content database.
- Path: `/Users/fatboy/geo-marketing/shared/GEOFlow`
- PetTomo symlink: `/Users/fatboy/geo-marketing/projects/pettomo/deployments/GEOFlow`
- Kairogu symlink: `/Users/fatboy/geo-marketing/projects/kairogu/deployments/GEOFlow`
- Runtime: Docker Compose.
- Services: `app`, `postgres`, `redis`, `queue`, `scheduler`, `reverb`.
- Local app endpoint: `http://127.0.0.1:18080`
- Local admin endpoint: `http://127.0.0.1:18080/geo_admin/login`
- Local realtime endpoint: `http://127.0.0.1:18081`
- Local Postgres endpoint: `127.0.0.1:15432`
- Local Redis endpoint: `127.0.0.1:16379`

### PetTomo Publishing Node

- Project path: `/Users/fatboy/geo-marketing/projects/pettomo`
- App source path: `/Users/fatboy/pet`
- Real asset source path: `/Users/fatboy/pet/assets`
- Export script: `scripts/export_geoflow_guides.mjs`
- Manifest: `scripts/geoflow_guides_manifest.json`
- Static output: `html/`
- Guide output: `html/guides/`
- Hosting config: `firebase.json`
- Firebase project: `pet-app-702be`
- Public hosting: `https://pet-app-702be.web.app`

### Kairogu Publishing Node

- Marketing project path: `/Users/fatboy/geo-marketing/projects/kairogu`
- App source path: `/Users/fatboy/kurabe`
- Real asset source path: `/Users/fatboy/kurabe/assets`
- Kairogu app content flow: `/Users/fatboy/kurabe/docs/geoflow_kairogu_content_flow.md`
- Marketing workflow doc: `docs/geoflow_content_workflow.md`
- Export script: `scripts/export_geoflow_guides.mjs`
- Manifest: `scripts/geoflow_guides_manifest.json`
- Static output: `html/`
- Vercel config: `vercel.json` (`buildCommand: null`, `outputDirectory: html`)
- Git repo: `cc100053/geo-marketing`, Vercel root directory: `projects/kairogu`
- Current Vercel production project: `kurabe`
- Public hosting: `https://www.kairogu.men`

Important naming distinction:

- GitHub repository for marketing content: `cc100053/geo-marketing`
- Vercel production project for the Kairogu site: `kurabe`
- Custom domain on that Vercel project: `www.kairogu.men`

Do not confuse the GitHub repo name with the Vercel project name. The correct
production site is the Vercel project `kurabe`, even though its source repo is
`geo-marketing`.

Note: a Vercel project named `geo-marketing` was created incidentally via CLI.
The production custom domain (`www.kairogu.men`) is on the `kurabe` project.
Do not delete Vercel projects without explicit approval.

### Daily Automation Node

- Automation ID: `daily-pettomo-geo-and-seo-marketing`
- Config path: `/Users/fatboy/.codex/automations/daily-pettomo-geo-and-seo-marketing/automation.toml`
- Memory path: `/Users/fatboy/.codex/automations/daily-pettomo-geo-and-seo-marketing/memory.md`
- Schedule: `FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0`
- Model: `gpt-5.5`
- Working directories: `/Users/fatboy/geo-marketing`, `/Users/fatboy/kurabe`
- Default behavior: work on PetTomo and Kairogu when feasible.

## Public Endpoints

### PetTomo

- Home: `https://pet-app-702be.web.app/`
- Guide index: `https://pet-app-702be.web.app/guides/`
- Sitemap: `https://pet-app-702be.web.app/sitemap.xml`
- Robots: `https://pet-app-702be.web.app/robots.txt`
- English guide index: `https://pet-app-702be.web.app/guides/en/`
- Traditional Chinese guide index: `https://pet-app-702be.web.app/guides/zh-hant/`
- Simplified Chinese guide index: `https://pet-app-702be.web.app/guides/zh-hans/`
- Japanese guide index: `https://pet-app-702be.web.app/guides/ja/`
- Korean guide index: `https://pet-app-702be.web.app/guides/ko/`

### Kairogu

- Home: `https://www.kairogu.men/`
- Guide index: `https://www.kairogu.men/guides/`
- Sitemap: `https://www.kairogu.men/sitemap.xml`
- Robots: `https://www.kairogu.men/robots.txt`
- Japanese guide index: `https://www.kairogu.men/guides/ja/`
- Current guide article: `https://www.kairogu.men/guides/ja/price-recording-app.html`

## Local Service Commands

Run GEOFlow from `/Users/fatboy/geo-marketing/shared/GEOFlow`:

```sh
docker compose up -d --no-build
docker compose ps
docker compose logs --tail=120 app
docker compose logs --tail=120 queue
```

Use `docker compose build app` only when the GEOFlow app image needs rebuilding.
Use `--no-build` for normal restarts to avoid unnecessary image rebuilds.

## PetTomo Workflow

From `/Users/fatboy/geo-marketing/projects/pettomo`:

```sh
node --check scripts/export_geoflow_guides.mjs
node scripts/export_geoflow_guides.mjs
git diff --check
FIREBASE_CLI_DISABLE_UPDATE_CHECK=true firebase deploy --only hosting --project pet-app-702be --non-interactive
curl -I https://pet-app-702be.web.app/guides/
curl -I https://pet-app-702be.web.app/sitemap.xml
```

Content rule:

```text
1 topic = 5 language pages = 1 hreflang group
```

Supported languages:

- `en`
- `zh-hant`
- `zh-hans`
- `ja`
- `ko`

Do not hand-edit generated files under `html/guides/`. Update GEOFlow records
and `scripts/geoflow_guides_manifest.json`, then rerun the exporter.

## Kairogu Workflow

From `/Users/fatboy/geo-marketing/projects/kairogu`:

```sh
node --check scripts/export_geoflow_guides.mjs
node scripts/export_geoflow_guides.mjs
git diff --check
git add docs/articles/ scripts/geoflow_guides_manifest.json html/
git commit -m "update Kairogu guides"
git push
curl -I https://www.kairogu.men/guides/
curl -I https://www.kairogu.men/sitemap.xml
curl -I https://www.kairogu.men/guides/ja/price-recording-app.html
```

The Vercel `kurabe` project is connected to `cc100053/geo-marketing` with root
directory `projects/kairogu`. Push triggers auto-deploy. `vercel.json` sets
`buildCommand: null` so Vercel serves the committed `html/` folder directly.
The export script requires local Docker/GEOFlow and cannot run on Vercel CI.

In Codex automation, `git push` may need escalated network access. The default
sandbox can fail DNS resolution for GitHub, which prevents the Vercel Git
deployment from starting even when the local commit is valid. If a sandboxed
push fails with `Could not resolve host: github.com` or another host-resolution
error, fix it by rerunning the same command with `sandbox_permissions:
require_escalated` and a `git push` prefix rule. Do not switch to
`vercel deploy --prod` as a workaround.

Recovery checklist for this failure:

```sh
git status --short --branch
git push
curl -I https://www.kairogu.men/guides/
curl -I https://www.kairogu.men/sitemap.xml
curl -I https://www.kairogu.men/guides/ja/<new-slug>.html
```

If the branch was ahead before the retry and is no longer ahead afterward, the
GitHub push succeeded and Vercel should start deploying the `kurabe` project.
The new article may return 404 until that deployment finishes; wait briefly and
rerun the live URL checks.

`projects/kairogu/html/` is the only deployable static-site source. The old
`projects/kairogu/web-landing/` migration copy has been removed; do not recreate
or deploy a second static-site folder.

Do not use `vercel deploy --prod` for routine Kairogu publishing. Because the
Vercel project root directory is already `projects/kairogu`, direct CLI deploys
from the wrong directory can either resolve to `projects/kairogu/projects/kairogu`
or attach to the incidental `geo-marketing` Vercel project. The safe deployment
path is commit + push to `cc100053/geo-marketing`, then verify the Git-triggered
`kurabe` production deployment.

Content rule:

```text
1 topic = 1 Japanese page = 1 reviewed guide URL
```

Kairogu content must use Japanese copy, Japanese keywords, and `カイログ` as the
primary product name. Avoid unsupported claims including:

- `必ず最安`
- `絶対に節約できる`
- `地域で一番安い`
- `全店舗の価格がわかる`

Before changing Kairogu app facts or app-linked pages, read
`/Users/fatboy/kurabe/AGENTS.md` and
`/Users/fatboy/kurabe/docs/geoflow_kairogu_content_flow.md`. If app repo files
change, run from `/Users/fatboy/kurabe`:

```sh
flutter analyze
flutter test
```

## Daily Automation Workflow

The automation should:

1. Read memory first:
   `/Users/fatboy/.codex/automations/daily-pettomo-geo-and-seo-marketing/memory.md`
2. Choose a distinct marketing angle for the day.
3. Work on both apps when feasible:
   - PetTomo: multilingual guide creation, refresh, internal linking, sitemap,
     or answer-engine optimization.
   - Kairogu: exactly one Japanese article creation or refresh.
4. Review product claims before exporting.
5. Update GEOFlow records and app manifests when new articles are publishable.
6. Export static HTML.
7. Run verification checks.
8. Deploy only after coherent generated output passes checks.
9. Report projects, angles, work completed, live URLs, verification, and any
   `[USER ACTION REQUIRED]` Search Console steps.
10. Update automation memory before returning.

## Hosting Recommendation

Keep the current split:

- PetTomo on Firebase Hosting.
- Kairogu on Vercel.

Using separate providers is acceptable because each app already has an existing
deployment path, live domain, and hosting configuration. Consolidate only if
there is a deliberate operational reason, such as unified preview deployments,
centralized DNS, billing simplification, or one rollback system.

## Search Console

[USER ACTION REQUIRED] Submit or refresh these sitemaps when content changes:

- `https://pet-app-702be.web.app/sitemap.xml`
- `https://www.kairogu.men/sitemap.xml`

Request indexing for newly published or substantially refreshed guide URLs.
