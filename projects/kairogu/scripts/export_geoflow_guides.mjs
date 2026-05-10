#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const geoflowDir = path.join(projectRoot, 'deployments', 'GEOFlow');
const outputDir = path.join(projectRoot, 'html', 'guides');
const defaultManifestPath = path.join(projectRoot, 'scripts', 'geoflow_guides_manifest.json');
const defaultBaseUrl = 'https://www.kairogu.men';

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, ...value] = arg.slice(2).split('=');
      return [key, value.join('=') || 'true'];
    }),
);

const baseUrl = (args.get('base-url') || defaultBaseUrl).replace(/\/+$/, '');
const manifestPath = args.get('manifest')
  ? path.resolve(projectRoot, args.get('manifest'))
  : defaultManifestPath;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const guideEntries = manifest.articles || [];

if (guideEntries.length === 0) {
  fail('No guide articles are configured.');
}

const articles = await loadArticles(guideEntries);

await mkdir(outputDir, { recursive: true });

for (const article of articles) {
  await writeGuideFile(article.outputPath, renderArticlePage(article));
}

await writeFile(path.join(outputDir, 'index.html'), renderGuidesIndex(articles));
await writeGuideFile('ja/index.html', renderGuidesIndex(articles, 'ja'));
await writeFile(path.join(projectRoot, 'html', 'sitemap.xml'), renderSitemap(articles));
await writeFile(path.join(projectRoot, 'html', 'robots.txt'), renderRobots());

console.log(`Exported ${articles.length} Kairogu guide page(s) to ${outputDir}`);

async function loadArticles(entries) {
  const geoflowEntries = entries.filter((entry) => Number.isFinite(Number(entry.id)));
  const localEntries = entries.filter((entry) => !Number.isFinite(Number(entry.id)));
  const geoflowArticles = geoflowEntries.length > 0 ? fetchGeoflowArticles(geoflowEntries) : [];
  const localArticles = localEntries.map(loadLocalArticle);
  const byKey = new Map([...geoflowArticles, ...localArticles].map((article) => [article.manifestKey, article]));

  return entries.map((entry, index) => {
    const key = manifestKey(entry, index);
    const article = byKey.get(key);
    if (!article) {
      fail(`Missing article for manifest entry ${key}`);
    }
    return article;
  });
}

function fetchGeoflowArticles(entries) {
  const ids = entries.map((entry) => Number(entry.id));
  const phpIds = ids.join(',');
  const php = [
    '$articles = App\\Models\\Article::query()',
    `  ->whereIn("id", [${phpIds}])`,
    '  ->orderBy("id")',
    '  ->get(["id", "title", "slug", "content", "excerpt", "keywords", "meta_description", "created_at", "updated_at", "published_at"]);',
    'echo $articles->toJson(JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);',
  ].join('\n');

  const result = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'app', 'php', 'artisan', 'tinker', '--execute', php],
    { cwd: geoflowDir, encoding: 'utf8' },
  );

  if (result.error) {
    fail(`Failed to run Docker Compose: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(
      [
        'Failed to read GEOFlow articles.',
        'Make sure Docker is running and start GEOFlow with:',
        '  cd deployments/GEOFlow',
        '  docker compose up -d --no-build',
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout.trim());
  } catch (error) {
    fail(`GEOFlow returned invalid JSON: ${error.message}\n${result.stdout.trim()}`);
  }

  const entryById = new Map(entries.map((entry, index) => [Number(entry.id), { entry, index }]));
  return payload.map((record) => {
    const match = entryById.get(Number(record.id));
    return normalizeArticle({
      manifestKey: manifestKey(match.entry, match.index),
      title: record.title,
      description: record.meta_description || record.excerpt,
      keyword: record.keywords,
      content: record.content,
      slug: match.entry.slug || record.slug,
      group: match.entry.group,
      lang: match.entry.lang || 'ja',
      updatedAt: record.updated_at || record.published_at || record.created_at,
    });
  });
}

function loadLocalArticle(entry, index) {
  if (!entry.sourcePath) {
    fail(`Manifest entry ${manifestKey(entry, index)} needs either id or sourcePath.`);
  }
  const sourcePath = path.resolve(projectRoot, entry.sourcePath);
  const raw = readFileSync(sourcePath, 'utf8');
  const parsed = parseFrontMatter(raw);
  return normalizeArticle({
    manifestKey: manifestKey(entry, index),
    title: entry.title || parsed.data.title,
    description: entry.description || parsed.data.description,
    keyword: entry.keyword || parsed.data.keyword,
    content: parsed.body,
    slug: entry.slug || parsed.data.slug,
    group: entry.group || parsed.data.group,
    lang: entry.lang || parsed.data.lang || 'ja',
    updatedAt: new Date().toISOString(),
  });
}

function normalizeArticle(article) {
  const lang = article.lang || 'ja';
  const slug = article.slug || slugify(article.title);
  const outputPath = `${lang}/${slug}.html`;
  const description =
    article.description || truncateSentence(markdownToPlainText(article.content), 155);
  const keyword = article.keyword || '価格記録 アプリ, カイログ, 買い物リスト, 底値チェック';

  return {
    ...article,
    lang,
    slug,
    outputPath,
    description: truncateSentence(String(description).replace(/\s+/g, ' ').trim(), 155),
    keyword,
    canonicalUrl: `${baseUrl}/guides/${outputPath}`,
    updatedAt: article.updatedAt || new Date().toISOString(),
  };
}

function parseFrontMatter(raw) {
  const normalized = String(raw || '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { data: {}, body: normalized.trim() };
  }
  const closing = normalized.indexOf('\n---\n', 4);
  if (closing === -1) {
    return { data: {}, body: normalized.trim() };
  }

  const frontMatter = normalized.slice(4, closing);
  const body = normalized.slice(closing + 5).trim();
  const data = {};

  for (const line of frontMatter.split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    data[key] = value;
  }

  return { data, body };
}

async function writeGuideFile(relativePath, html) {
  const target = path.join(outputDir, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
}

function renderArticlePage(article) {
  const articleHtml = renderMarkdown(article.content);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    inLanguage: 'ja',
    author: {
      '@type': 'Organization',
      name: 'カイログ編集部',
    },
    publisher: {
      '@type': 'Organization',
      name: 'カイログ',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/icon.png`,
      },
    },
    mainEntityOfPage: article.canonicalUrl,
    dateModified: article.updatedAt,
  };

  return pageShell({
    title: `${article.title} | カイログ ガイド`,
    description: article.description,
    keywords: article.keyword,
    canonicalUrl: article.canonicalUrl,
    bodyClass: 'article-page',
    main: `
      <main class="article-shell">
        <p class="eyebrow"><a href="/guides/">カイログ ガイド</a></p>
        <article class="article">
          <h1>${escapeHtml(article.title)}</h1>
          <p class="article-summary">${escapeHtml(article.description)}</p>
          <div class="article-meta">更新日 ${formatDate(article.updatedAt)}</div>
          <div class="article-content">
            ${articleHtml}
          </div>
        </article>
        <nav class="article-nav" aria-label="Guide navigation">
          <a href="/guides/">すべてのガイド</a>
          <a href="/guides/ja/">日本語ガイド</a>
          <a href="/">カイログ ホーム</a>
        </nav>
      </main>
      <script type="application/ld+json">${escapeScriptJson(jsonLd)}</script>
    `,
  });
}

function renderGuidesIndex(articles, language = null) {
  const visibleArticles = language ? articles.filter((article) => article.lang === language) : articles;
  const cards = visibleArticles
    .map(
      (article) => [
        `        <a class="guide-card" href="/guides/${article.outputPath}">`,
        `          <span class="guide-label">日本語</span>`,
        `          <h2>${escapeHtml(article.title)}</h2>`,
        `          <p>${escapeHtml(article.description)}</p>`,
        `        </a>`,
      ].join('\n'),
    )
    .join('\n');
  const title = language ? 'カイログ 日本語ガイド' : 'カイログ ガイド';
  const description =
    'スーパーやドラッグストアの価格記録、底値チェック、買い物リスト活用をまとめたカイログ公式ガイド。';

  return pageShell({
    title: `${title} | 価格記録と買い物リスト`,
    description,
    keywords: 'カイログ, 価格記録 アプリ, 底値 管理 アプリ, 買い物リスト アプリ, 価格タグ 読み取り',
    canonicalUrl: language ? `${baseUrl}/guides/${language}/` : `${baseUrl}/guides/`,
    bodyClass: 'guides-page',
    main: `
      <main class="guides-shell">
        <section class="guides-hero">
          <div>
            <p class="eyebrow">カイログ ガイド</p>
            <h1>毎日の買い物を、記録で比べやすく。</h1>
            <p>${escapeHtml(description)}</p>
          </div>
          <img src="/icon.png" alt="カイログ app icon">
        </section>
        <section class="guide-grid" aria-label="カイログ guide articles">
${cards}
        </section>
      </main>
    `,
  });
}

function renderSitemap(articles) {
  const staticPages = [
    ['', 'monthly'],
    ['privacy.html', 'yearly'],
    ['terms.html', 'yearly'],
    ['account-deletion.html', 'yearly'],
    ['guides/', 'weekly'],
    ['guides/ja/', 'weekly'],
    ...articles.map((article) => [`guides/${article.outputPath}`, 'weekly']),
  ];

  const urls = staticPages
    .map(([location, changefreq]) => {
      const loc = `${baseUrl}/${location}`;
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <changefreq>${changefreq}</changefreq>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml
`;
}

function pageShell({ title, description, keywords, canonicalUrl, bodyClass, main }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="icon" type="image/png" href="/icon.png">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${baseUrl}/icon.png">
  <style>
    :root {
      --primary: #1A8D7A;
      --accent: #F4A261;
      --bg: #FAF9F7;
      --panel: #FFFFFF;
      --text: #242424;
      --muted: #667085;
      --line: #E5E1DA;
      --soft: #EEF8F5;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Segoe UI", sans-serif;
      line-height: 1.8;
    }

    a { color: inherit; }

    .site-header,
    .site-footer {
      max-width: 1120px;
      margin: 0 auto;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: var(--primary);
      font-size: 1.18rem;
      font-weight: 800;
      text-decoration: none;
    }

    .brand img {
      width: 42px;
      height: 42px;
      border-radius: 10px;
    }

    .site-nav {
      display: flex;
      gap: 18px;
      color: var(--muted);
      font-weight: 700;
      font-size: 0.95rem;
    }

    .site-nav a,
    .site-footer a,
    .eyebrow a {
      text-decoration: none;
    }

    .site-nav a:hover,
    .site-footer a:hover,
    .eyebrow a:hover {
      color: var(--primary);
    }

    .guides-shell,
    .article-shell {
      max-width: 1120px;
      margin: 0 auto;
      padding: 28px 20px 72px;
    }

    .guides-hero {
      min-height: 300px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 150px;
      gap: 40px;
      align-items: center;
      padding: 52px 0 40px;
      border-bottom: 1px solid var(--line);
    }

    .guides-hero img {
      width: 132px;
      height: 132px;
      border-radius: 28px;
      box-shadow: 0 16px 34px rgba(36, 36, 36, 0.12);
    }

    .eyebrow,
    .guide-label {
      margin: 0 0 12px;
      color: var(--primary);
      font-size: 0.82rem;
      font-weight: 900;
      letter-spacing: 0;
    }

    h1 {
      max-width: 840px;
      margin: 0;
      font-size: clamp(2.1rem, 6vw, 4rem);
      line-height: 1.12;
      letter-spacing: 0;
    }

    .guides-hero p:not(.eyebrow),
    .article-summary {
      max-width: 760px;
      margin: 22px 0 0;
      color: var(--muted);
      font-size: 1.08rem;
    }

    .guide-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
      padding-top: 34px;
    }

    .guide-card {
      min-height: 220px;
      padding: 24px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      text-decoration: none;
      box-shadow: 0 10px 24px rgba(36, 36, 36, 0.06);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .guide-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 16px 32px rgba(36, 36, 36, 0.1);
    }

    .guide-card h2 {
      margin: 0;
      font-size: 1.24rem;
      line-height: 1.35;
    }

    .guide-card p {
      margin: 14px 0 0;
      color: var(--muted);
      font-size: 0.98rem;
    }

    .article {
      max-width: 860px;
      margin: 26px auto 0;
      padding-bottom: 36px;
      border-bottom: 1px solid var(--line);
    }

    .article-meta {
      margin-top: 14px;
      color: var(--muted);
      font-size: 0.94rem;
    }

    .article-content {
      margin-top: 34px;
      font-size: 1.04rem;
    }

    .article-content h2,
    .article-content h3 {
      margin: 34px 0 12px;
      line-height: 1.35;
      letter-spacing: 0;
    }

    .article-content h2 { font-size: 1.58rem; }
    .article-content h3 { font-size: 1.22rem; }

    .article-content p,
    .article-content li {
      color: #3F3A36;
    }

    .article-content ul,
    .article-content ol {
      padding-left: 1.35rem;
    }

    .article-nav {
      max-width: 860px;
      margin: 24px auto 0;
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
    }

    .article-nav a {
      padding: 10px 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      color: var(--primary);
      font-weight: 800;
      text-decoration: none;
    }

    @media (max-width: 720px) {
      .site-header,
      .site-footer {
        align-items: flex-start;
        flex-direction: column;
      }

      .guides-hero {
        grid-template-columns: 1fr;
        min-height: auto;
      }

      .guides-hero img {
        width: 104px;
        height: 104px;
      }
    }
  </style>
</head>
<body class="${escapeHtml(bodyClass)}">
  <header class="site-header">
    <a class="brand" href="/">
      <img src="/icon.png" alt="カイログ">
      <span>カイログ</span>
    </a>
    <nav class="site-nav" aria-label="Site navigation">
      <a href="/guides/">ガイド</a>
      <a href="/privacy.html">プライバシー</a>
      <a href="/terms.html">利用規約</a>
    </nav>
  </header>
${String(main).trim()}
  <footer class="site-footer">
    <span>&copy; 2026 CHIANG CHI NAM</span>
    <a href="mailto:hangyodev@gmail.com">お問い合わせ</a>
  </footer>
</body>
</html>
`;
}

function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listType = null;
  let skipFirstTitle = true;

  function flushParagraph() {
    if (paragraph.length > 0) {
      html.push(`<p>${escapeHtml(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  }

  function closeList() {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      closeList();
      if (skipFirstTitle && heading[1] === '#') {
        skipFirstTitle = false;
        continue;
      }
      skipFirstTitle = false;
      const level = Math.min(heading[1].length, 3);
      html.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      continue;
    }

    skipFirstTitle = false;

    const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
    if (unordered) {
      flushParagraph();
      if (listType !== 'ul') {
        closeList();
        html.push('<ul>');
        listType = 'ul';
      }
      html.push(`<li>${escapeHtml(unordered[1])}</li>`);
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      if (listType !== 'ol') {
        closeList();
        html.push('<ol>');
        listType = 'ol';
      }
      html.push(`<li>${escapeHtml(ordered[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  return html.join('\n');
}

function markdownToPlainText(markdown) {
  return String(markdown || '')
    .replace(/^---[\s\S]*?---/m, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return String(value || 'guide')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function truncateSentence(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength + 1);
  const boundary = Math.max(
    clipped.lastIndexOf('。'),
    clipped.lastIndexOf('！'),
    clipped.lastIndexOf('？'),
    clipped.lastIndexOf('.'),
  );
  if (boundary > 40) return clipped.slice(0, boundary + 1);
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function manifestKey(entry, index = 0) {
  return entry.id ? `id:${entry.id}` : `source:${entry.sourcePath || index}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
