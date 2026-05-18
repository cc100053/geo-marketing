# GEOFlow Content Workflow

This workflow treats GEOFlow as the content database/CMS and Firebase Hosting as
the static publishing target.

## Goal

For each new SEO/GEO topic:

1. Create one source article.
2. Translate/localize it into all supported market languages.
3. Apply GEO optimization.
4. Review the full language set.
5. Export static HTML from GEOFlow records.
6. Deploy to Firebase Hosting.

Supported guide languages:

- `en`
- `zh-hant`
- `zh-hans`
- `ja`
- `ko`

## Source Of Truth

- GEOFlow DB: article body, title, keyword, meta description, review status.
- `scripts/geoflow_guides_manifest.json`: publishing map from GEOFlow article
  ids to language, translation group, slug, and legacy aliases.
- `html/guides/`: generated static output. Do not hand-edit generated guide
  pages.
- Real app assets for official-site visuals come from `/Users/fatboy/pet/assets`.
  Copy optimized derivatives into `html/assets/` before referencing them from
  deployed HTML.

Useful PetTomo asset source folders:

- `/Users/fatboy/pet/assets/appstore/`: localized App Store screenshots.
- `/Users/fatboy/pet/assets/app/`: app icon, launch logo, app UI artwork.
- `/Users/fatboy/pet/assets/pet/`: pet GIFs and animation assets.
- `/Users/fatboy/pet/assets/icon/`: UI icon SVGs.

## Per-Article Workflow

### 1. Define The Topic

For each article, capture:

- Translation group id, for example `shared-rooms` or
  `long-distance-check-ins`.
- Search intent.
- Primary keyword per language.
- Target audience.
- PetTomo facts that must be included.
- Claims to avoid.

Good topic shape:

- One clear user question.
- One primary keyword.
- One page per language.
- No duplicate intent with an existing article unless the angle is clearly
  different.

### 2. Create The Source Article

Create the source article in English first unless the topic is specifically for
a non-English market.

The article should include:

- H1 matching the search intent.
- Key takeaways.
- Clear explanation of PetTomo's product facts.
- Scenario-based usage advice.
- FAQ section.
- Conclusion.
- Natural internal-link opportunities.

Do not claim:

- PetTomo is a public social network.
- PetTomo replaces real communication.
- PetTomo guarantees relationship outcomes.
- Features that are not live in the app.

### 3. Localize Into Five Languages

Create localized article records for:

- English: `en`
- Traditional Chinese: `zh-hant`
- Simplified Chinese: `zh-hans`
- Japanese: `ja`
- Korean: `ko`

Localization requirements:

- Translate the title, meta description, keyword, excerpt, and body.
- Keep product facts consistent across languages.
- Avoid machine-translation tone; each language should read naturally.
- Adapt phrasing for local search behavior where appropriate.
- Keep the same translation group id across languages.

Each language gets its own URL:

```text
/guides/en/<slug>.html
/guides/zh-hant/<slug>.html
/guides/zh-hans/<slug>.html
/guides/ja/<slug>.html
/guides/ko/<slug>.html
```

### 4. GEO Optimization

For each language page, verify:

- The title directly answers the query.
- The opening summary can be quoted by AI answer engines.
- Key takeaways are clear and specific.
- FAQ answers are short, direct, and factual.
- The page uses PetTomo-specific details, not generic virtual-pet filler.
- Meta description is complete and not truncated mid-phrase.
- Related pages can be linked from the guide index and sitemap.

Preferred structure:

```text
# Title

## Key Takeaways

## Context / Why It Matters

## How PetTomo Helps

## Practical Use Cases

## FAQ

## Conclusion
```

### 5. Editorial Review

Before publishing, check:

- No unsupported or exaggerated claims.
- No stale product behavior.
- No duplicate pages with the same intent.
- No mixed-language paragraphs.
- Correct `review_status = approved` in GEOFlow.
- Correct language, group, and slug in the manifest.

### 6. Update The Manifest

Add every approved GEOFlow article id to
`scripts/geoflow_guides_manifest.json`.

Required fields:

```json
{
  "id": 123,
  "group": "shared-rooms",
  "lang": "ja",
  "slug": "shared-rooms"
}
```

Use `legacyPaths` only when preserving an already-public URL:

```json
{
  "id": 7,
  "group": "shared-rooms",
  "lang": "en",
  "slug": "does-pettomo-support-shared-rooms",
  "legacyPaths": ["does-pettomo-support-shared-rooms.html"]
}
```

### 7. Export Static Pages

From the repo root:

```sh
node scripts/export_geoflow_guides.mjs
```

This command reads articles from GEOFlow via Docker Compose. If Docker is not
available in your environment, you can export from a pre-exported JSON snapshot
instead:

```sh
node scripts/export_geoflow_guides.mjs --articles-json=path/to/articles.json
```

For new guide records that are intentionally managed outside Docker/GEOFlow,
the manifest can point at local Markdown files with front matter:

```json
{
  "group": "shared-room-invites",
  "lang": "en",
  "slug": "shared-room-invites",
  "sourcePath": "docs/articles/shared-room-invites-en.md"
}
```

When the current environment cannot read the Docker socket, use the local
Markdown entries plus the existing generated HTML as the index/sitemap source:

```sh
node scripts/export_geoflow_guides.mjs --rebuild-from-html
```

This keeps old Docker-backed article pages intact, renders any local Markdown
entries, and refreshes guide indexes, sitemaps, and robots metadata. For
priority PetTomo topics, still add one local Markdown entry per supported
language so the page set remains:

```text
1 topic = 5 language pages = 1 hreflang group
```

When Docker is available, you can also write a snapshot while exporting:

```sh
node scripts/export_geoflow_guides.mjs --write-snapshot=tmp/geoflow_articles.json
```

Expected outputs:

- `html/guides/index.html`
- `html/guides/<language>/index.html`
- `html/guides/<language>/<slug>.html`
- `html/sitemap.xml`
- `html/robots.txt`

### 8. Verify Before Deploy

Run:

```sh
node --check scripts/export_geoflow_guides.mjs
git diff --check
flutter analyze
flutter test
```

Also inspect generated output:

```sh
rg -n "hreflang|canonical" html/guides/<language>/<slug>.html
rg -n "guides/(en|zh-hant|zh-hans|ja|ko)/" html/sitemap.xml
```

### 9. Deploy

Deploy to the existing Firebase Hosting site:

```sh
FIREBASE_CLI_DISABLE_UPDATE_CHECK=true firebase deploy --only hosting --project pet-app-702be --non-interactive
```

Then verify live pages:

```sh
curl -I https://pet-app-702be.web.app/guides/
curl -I https://pet-app-702be.web.app/sitemap.xml
curl -I https://pet-app-702be.web.app/guides/ja/<slug>.html
```

### 10. Search Console

[USER ACTION REQUIRED] In Google Search Console:

1. Resubmit `sitemap.xml`.
2. Inspect one or two new URLs.
3. Request indexing for important hub pages:
   - `https://pet-app-702be.web.app/guides/`
   - `https://pet-app-702be.web.app/guides/en/`
   - `https://pet-app-702be.web.app/guides/ja/`

## Section-Level Workflow

When creating a new content section, repeat the per-article workflow for each
topic, then add a section review:

- Does the section have a clear hub/search theme?
- Are there at least 3-5 useful pages before publishing the section?
- Are page intents distinct?
- Are all five languages present for the priority pages?
- Are the pages internally linked from the language index?
- Does the sitemap include every new URL?

## Current Publishing Rule

Do not publish a partial language set for a priority page unless the user
explicitly asks for a market-specific experiment. Default is:

```text
1 topic = 5 language pages = 1 hreflang group
```
