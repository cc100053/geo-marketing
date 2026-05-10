# GEOFlow Deployment

GEOFlow is an external Laravel content system for GEO/SEO operations. Keep it
outside the Flutter app runtime. The app can later link to the deployed guide
site, but the Laravel app, PostgreSQL, Redis, queue, scheduler, and admin UI
should run as their own service.

## Local Deployment

The local checkout is intentionally ignored by Git:

- Path: `deployments/GEOFlow`
- Git ignore rule: `deployments/`
- Local front site: `http://127.0.0.1:18080`
- Local admin login: `http://127.0.0.1:18080/geo_admin/login`
- Local admin username: `admin`

The local password is environment-specific. Do not commit it into this repo.

Use these commands from `deployments/GEOFlow`:

```sh
docker compose build app
docker compose up -d --no-build
docker compose ps
```

Why `build app`: GEOFlow's development compose file defines several services
that build the same `geoflow-app:latest` image. Docker Compose v5 can collide
when those services export the same tag in parallel. Building the shared app
image once, then starting with `--no-build`, avoids that collision.

Stop the local deployment:

```sh
docker compose down
```

View logs:

```sh
docker compose logs --tail=120 app
docker compose logs --tail=120 queue
```

Reset the local admin password:

```sh
docker compose exec -T app php artisan tinker --execute '$admin = App\Models\Admin::where("username", "admin")->firstOrFail(); $admin->password = "REPLACE_WITH_STRONG_PASSWORD"; $admin->save();'
```

## How To Use GEOFlow For PetTomo

Recommended first use:

1. Configure one chat model in the admin model settings.
2. Add an embedding model only if knowledge-base RAG is needed.
3. Build a real knowledge base first: app FAQ, room-sharing rules, account
   deletion policy, subscription/IAP explanations, privacy and safety notes,
   onboarding explanations, and troubleshooting.
4. Add title libraries and keyword libraries around real PetTomo search intent.
5. Generate a small number of draft articles first.
6. Review manually before publishing.
7. Link the public site from the app only after the content is useful.

Good PetTomo content clusters:

- Shared virtual pet app guides
- Couple and friend pet-room use cases
- Photo feeding and pet-care gameplay
- Account deletion, privacy, support, and subscription FAQ
- Release notes and feature explainers

Avoid using GEOFlow to publish low-quality bulk pages. Its useful role is to
turn real product knowledge into structured, reviewable, AI-search-friendly
content.

## Free Firebase Hosting Workflow

Firebase Hosting's free Spark plan can serve static HTML, CSS, images, and
JavaScript from the PetTomo publishing unit's `html/` directory:

```text
/Users/fatboy/geo-marketing/projects/pettomo/html/
```

It cannot run GEOFlow's Laravel app, PostgreSQL, Redis, queue worker, or
scheduler directly. For the free path, use GEOFlow locally as the CMS/drafting
system, then export reviewed articles into static guide pages.

The current export script publishes only the reviewed PetTomo guide article ids
by default. It intentionally excludes old local test articles that were created
from the wrong prompt/context:

```sh
node scripts/export_geoflow_guides.mjs
```

Outputs:

- `html/guides/index.html`
- `html/guides/en/index.html`
- `html/guides/zh-hant/index.html`
- `html/guides/zh-hans/index.html`
- `html/guides/ja/index.html`
- `html/guides/ko/index.html`
- `html/guides/<article-slug>.html`
- `html/sitemap.xml`
- `html/robots.txt`

The public guide export is manifest-based. GEOFlow remains the content
database, while `scripts/geoflow_guides_manifest.json` maps reviewed article ids
to language, translation group, public slug, and any legacy URL aliases. Keep
the manifest current when adding new GEOFlow article records.

Supported guide language folders:

- `en`
- `zh-hant`
- `zh-hans`
- `ja`
- `ko`

Article pages include canonical URLs and `hreflang` alternates for every
translation in the same group.

For the full article creation, localization, GEO optimization, review, export,
deploy, and Search Console process, use
`docs/geoflow_content_workflow.md`.

Use a different production URL when needed:

```sh
node scripts/export_geoflow_guides.mjs --base-url=https://example.com
```

Publish to the existing PetTomo Firebase Hosting site only from the PetTomo
publishing unit after reviewing the generated pages:

```sh
cd /Users/fatboy/geo-marketing/projects/pettomo
FIREBASE_CLI_DISABLE_UPDATE_CHECK=true firebase deploy --only hosting --project pet-app-702be --non-interactive
```

[USER ACTION REQUIRED] Submit `https://pet-app-702be.web.app/sitemap.xml` in
Google Search Console after the first public deploy, then request indexing for
`https://pet-app-702be.web.app/guides/`.

## Production Deployment

For production, prefer GEOFlow's `docker-compose.prod.yml`, which runs Nginx
plus PHP-FPM instead of the development `php artisan serve` process.

Production checklist:

- [USER ACTION REQUIRED] Choose the public URL, for example
  `https://guides.pettomo.app` or `https://learn.pettomo.app`.
- [USER ACTION REQUIRED] Point DNS to the server.
- [USER ACTION REQUIRED] Provide server SSH access or run the deploy commands on
  the server.
- Set `APP_URL` and `SITE_URL` to the public HTTPS URL.
- Set `APP_ENV=production`, `APP_DEBUG=false`, and a persistent `APP_KEY`.
- Use strong PostgreSQL and admin passwords.
- Keep `ADMIN_BASE_PATH` non-obvious if the site is public.
- Put TLS and proxy headers in front of Nginx.
- Back up PostgreSQL and uploaded storage.
- After publishing, add only a simple external app link to the guide site.

Do not expose the repository root as a web document root. GEOFlow production
traffic should go through Nginx, and the web root should be `public/`.
