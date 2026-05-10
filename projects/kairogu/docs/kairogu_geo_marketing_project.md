# カイログ GEO Marketing Project

## Purpose

This folder is the GEO/SEO publishing unit for カイログ inside the
`geo-marketing` workspace. Keep app runtime code in `/Users/fatboy/kurabe` and
keep marketing content, exported static guide pages, Vercel static hosting
config, and GEOFlow publishing notes here.

## Product Facts

- Product name: `カイログ`
- English/internal app repo name: `Kurabe`
- App category: Japanese grocery and daily-shopping price-tracking app
- App/bundle/package id: `com.cc100053.kurabe`
- Public website: `https://www.kairogu.men/`
- Terms: `https://www.kairogu.men/terms.html`
- Privacy policy: `https://www.kairogu.men/privacy.html`
- Account deletion page: `https://www.kairogu.men/account-deletion.html`
- Support email: `hangyodev@gmail.com`
- Primary market: Japan
- Content language: Japanese only

## Core Positioning

カイログは、スーパーやドラッグストアで見つけた価格を記録し、あとから
見返して比較できる価格管理アプリです。価格タグを撮影すると、AI が商品名、
価格、割引、容量、カテゴリを読み取り、日々の買い物メモを整理しやすくします。

Primary message:

```text
日々の買い物を、記憶だけに頼らず、記録でかしこく。
```

Store listing summary:

```text
AIで価格タグを読み取り、買い物リストと近くの底値チェックをまとめて管理。
```

## Target Audience

- 日本のスーパーやドラッグストアでよく買い物する人
- 食費や日用品費を見直したい人
- 特売、見切り品、割引品が本当に安いか確認したい人
- よく買う商品の底値を覚えておきたい人
- 買い物リストと価格メモを一緒に管理したい人
- 近くの店舗や地域の価格情報を参考にしたい人

## Live Product Capabilities

- 価格タグを撮影して商品価格を記録
- Gemini 1.5 Flash による商品名、価格、割引、容量、カテゴリの読み取り
- OCR 失敗時の同じ画像での再読み取り
- 商品名、価格、店舗、容量、カテゴリ、税率、割引情報の管理
- 100g あたり価格や容量ベースの比較
- 自分の価格履歴のタイムライン表示
- カテゴリ別の自分の記録と近くの価格情報
- 近くの価格情報は 3km / 20日以内の範囲を基本に扱う
- 買い物リスト
- お気に入り商品/店舗
- 店舗名から地図アプリを開く
- ゲスト、Google、Apple、メールでの利用開始
- ゲストデータのアカウント移行
- カイログ Pro による近くの価格情報と比較機能の活用

## Claims To Avoid

Do not publish unsupported claims such as:

- `必ず最安`
- `絶対に節約できる`
- `地域で一番安い`
- `全店舗の価格がわかる`
- `AIが必ず正確に読み取る`
- `バーコード価格比較`

Use careful wording:

- Good: `過去の記録と比べて、安いか判断しやすくなります。`
- Good: `近くの価格情報は、利用状況や投稿内容によって表示されます。`
- Bad: `近所で一番安い店が必ずわかります。`

## Hosting

Live hosting for `https://www.kairogu.men/` is Vercel, not Firebase.

Evidence checked on 2026-05-08:

- `curl -I https://www.kairogu.men/` returns `server: Vercel`.
- Response headers include `x-vercel-cache` and `x-vercel-id`.
- `www.kairogu.men` resolves as a CNAME to `vercel-dns-017.com`.

This project uses the shared `geo-marketing` workspace convention, adapted for
Vercel:

```text
projects/kairogu/
  html/                         # static public site root
  docs/                         # app-specific GEO/SEO docs and source drafts
  scripts/                      # export automation and manifest
  deployments/GEOFlow -> ../../../shared/GEOFlow
  vercel.json
```

The current `html/` folder is migrated from `/Users/fatboy/kurabe/web-landing`
and contains:

- `index.html`
- `privacy.html`
- `terms.html`
- `account-deletion.html`
- `app-ads.txt`
- `icon.png`

`vercel.json` sets `buildCommand: null` so Vercel serves the pre-built `html/`
directory directly. The export script cannot run on Vercel because it requires a
local Docker/GEOFlow instance. Always run the export locally and commit the
updated `html/` before deploying.

`html/` is the only deployable static-site source for カイログ. Do not copy or
sync generated output into `web-landing/`, and do not deploy from that directory.
It is retained only as a deprecated migration artifact, without its own Vercel
config, to avoid a second deploy path drifting from production.

The production deployment is intentionally Git-triggered:

- GitHub repo: `cc100053/geo-marketing`
- Vercel project: `kurabe`
- Vercel root directory: `projects/kairogu`
- Custom domain: `www.kairogu.men`

Do not run `vercel deploy --prod` for routine publishing. The CLI can resolve
the configured root directory twice or attach the repo root to the incidental
Vercel project named `geo-marketing`. The safe path is local export, commit,
push, then verify the `kurabe` production deployment.

## GEOFlow Usage

Use `../../../shared/GEOFlow` as the local CMS. For カイログ, keep the content
operation Japanese-only:

- `lang`: `ja`
- guide URL prefix: `/guides/ja/`
- public guide index: `/guides/`
- no hreflang language set required unless another market is explicitly added

Recommended GEOFlow setup:

- Site name: `カイログ ガイド`
- Front description: `スーパーやドラッグストアの価格記録、底値チェック、買い物リスト活用をまとめたカイログ公式ガイド。`
- Author name: `カイログ編集部`
- Review mode: enabled for all first-run articles
- Initial cadence: 1 approved Japanese article at a time

## Initial Keyword Libraries

### 価格記録・底値管理

- 価格記録 アプリ
- 底値 管理 アプリ
- 商品 価格 メモ
- スーパー 価格 記録
- 買い物 価格 比較
- 値段 記録 アプリ
- 価格履歴 アプリ
- 食品 価格 記録
- 日用品 価格 管理
- 底値チェック

### 買い物リスト・家計

- 買い物リスト アプリ
- 買い物メモ アプリ
- 食費 節約 アプリ
- 家計管理 買い物
- スーパー 買い物リスト
- 買い忘れ 防止 アプリ
- 日用品 買い物リスト
- 買い物 管理 アプリ

### AI・価格タグ読み取り

- 価格タグ 読み取り
- 値札 読み取り アプリ
- AI 価格 読み取り
- OCR 価格 記録
- 商品ラベル 読み取り
- 価格メモ 自動入力
- スーパー 値札 撮影
- 100g 価格 計算 アプリ

## Initial Marketing Article

The first Japanese marketing article is staged at:

```text
docs/articles/price-recording-app-ja.md
```

After creating the matching approved GEOFlow article record, update:

```text
scripts/geoflow_guides_manifest.json
```

Replace the temporary local source entry with the real GEOFlow `id` if the
content is promoted into GEOFlow as the canonical CMS record.

## Commands

From `projects/kairogu`:

```sh
node --check scripts/export_geoflow_guides.mjs
node scripts/export_geoflow_guides.mjs
git diff --check
```

Export, commit, then deploy:

```sh
node scripts/export_geoflow_guides.mjs
git diff --check
git add docs/articles/ scripts/geoflow_guides_manifest.json html/
git commit -m "update Kairogu guides"
git push
```

Live checks after deployment:

```sh
curl -I https://www.kairogu.men/guides/
curl -I https://www.kairogu.men/sitemap.xml
curl -I https://www.kairogu.men/guides/ja/price-recording-app.html
```

[USER ACTION REQUIRED] Submit `https://www.kairogu.men/sitemap.xml` in Google
Search Console after the first guide deploy.
