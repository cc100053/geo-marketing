# カイログ GEOFlow Content Workflow

This workflow is app-specific for カイログ and overrides the shared default
multi-language rule. カイログ currently targets Japan only, so publish Japanese
content only unless the product strategy changes.

## Source Of Truth

- App facts: `/Users/fatboy/kurabe/README.md`, `memory-bank/*.md`, and current
  store listing metadata.
- GEOFlow CMS: `deployments/GEOFlow` symlinked to `../../../shared/GEOFlow`.
- Publishing manifest: `scripts/geoflow_guides_manifest.json`.
- Static output: `html/guides/`. Do not hand-edit generated guide pages.

## Content Rule

```text
1 topic = 1 Japanese page = 1 reviewed guide URL
```

Default language:

- `ja`

## Per-Article Workflow

1. Define one search intent.
2. Choose one primary Japanese keyword.
3. Confirm the article uses only live カイログ features.
4. Draft in Japanese.
5. Review for unsupported claims.
6. Create or update the GEOFlow article record.
7. Add the approved article id to `scripts/geoflow_guides_manifest.json`.
8. Export static pages.
9. Deploy after checking generated HTML and sitemap.

## Required Article Metadata

For every article, capture:

- Group id, for example `price-recording-app`.
- Language: `ja`.
- Primary keyword.
- Slug.
- Meta description.
- Search intent.
- Claims to avoid.
- Related internal links.

## Preferred Structure

```markdown
# Title

導入: 買い物中の悩みを短く説明し、検索意図に答える。

## 要点

## なぜ価格を記録すると便利なのか

## 比較するときに見るポイント

## カイログでできること

## 注意したいこと

## よくある質問

## まとめ
```

## Review Checklist

- `カイログ` の説明が store listing と矛盾していない。
- `価格記録`, `買い物リスト`, `底値`, `価格タグ読み取り` などの語彙が自然に入っている。
- Pro 機能と無料機能を混同していない。
- 近くの価格情報の範囲や可用性を断定していない。
- AI 読み取り精度を保証していない。
- `バーコード価格比較` と書いていない。カイログの実装は価格タグ/OCR中心。
- FAQ は短く、AI answer engines が引用しやすい。

## Export

From `projects/kairogu`:

```sh
node scripts/export_geoflow_guides.mjs
```

Expected generated files:

- `html/guides/index.html`
- `html/guides/ja/index.html`
- `html/guides/ja/<slug>.html`
- `html/sitemap.xml`
- `html/robots.txt`

## Verify

```sh
node --check scripts/export_geoflow_guides.mjs
git diff --check
rg -n "canonical|application/ld\\+json" html/guides/ja/<slug>.html
rg -n "guides/ja/" html/sitemap.xml
```

Run Flutter checks from the app repo when app facts or app-linked pages changed:

```sh
cd /Users/fatboy/kurabe
flutter analyze
flutter test
```

## Deploy

Live hosting is Vercel. `vercel.json` sets `buildCommand: null` — Vercel serves
the committed `html/` folder directly. The export script requires local
Docker/GEOFlow and cannot run on Vercel CI.

`html/` is the only deployable static-site source for カイログ in this workspace.
Do not sync generated output into `web-landing/` and do not deploy from
`web-landing/`; that directory is retained only as a deprecated migration
artifact and intentionally has no Vercel config.

Deployment is Git-triggered, not direct CLI-triggered:

- GitHub repo: `cc100053/geo-marketing`
- Vercel production project: `kurabe`
- Vercel root directory: `projects/kairogu`
- Custom domain: `www.kairogu.men`

Do not run `vercel deploy --prod` for routine publishing. From inside
`projects/kairogu`, Vercel can append the configured root directory again and
look for `projects/kairogu/projects/kairogu`. From the repo root, the CLI can
attach to the incidental `geo-marketing` Vercel project. Commit and push instead.

```sh
node scripts/export_geoflow_guides.mjs
git diff --check
git add docs/articles/ scripts/geoflow_guides_manifest.json html/
git commit -m "update Kairogu guides"
git push
```

After deployment:

```sh
curl -I https://www.kairogu.men/guides/
curl -I https://www.kairogu.men/sitemap.xml
curl -I https://www.kairogu.men/guides/ja/price-recording-app.html
```
