#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const geoflowDir = path.join(repoRoot, 'deployments', 'GEOFlow');
const outputDir = path.join(repoRoot, 'html', 'guides');
const defaultManifestPath = path.join(repoRoot, 'scripts', 'geoflow_guides_manifest.json');

const defaultArticleIds = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const defaultBaseUrl = 'https://pet-app-702be.web.app';

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
const guideEntries = loadGuideEntries();
const articleIds = guideEntries
  .filter((entry) => Number.isFinite(entry.id) && !entry.sourcePath)
  .map((entry) => entry.id);
const entryById = new Map(
  guideEntries
    .filter((entry) => Number.isFinite(entry.id) && !entry.sourcePath)
    .map((entry, index) => [entry.id, { ...entry, manifestKey: manifestKey(entry, index) }]),
);
const snapshotOutputPath = args.get('write-snapshot');
const rebuildFromHtml = args.has('rebuild-from-html');

if (guideEntries.length === 0) {
  fail('No guide articles were provided.');
}

let articles = [];
if (rebuildFromHtml) {
  await mkdir(outputDir, { recursive: true });
  articles = await buildArticlesFromExistingHtml(guideEntries);
} else {
  articles = await loadArticles(guideEntries);
}
const byRequestedOrder = new Map(articles.map((article) => [article.manifestKey, article]));
const orderedArticles = guideEntries
  .map((entry, index) => byRequestedOrder.get(manifestKey(entry, index)))
  .filter(Boolean);

if (orderedArticles.length !== guideEntries.length) {
  const foundKeys = new Set(orderedArticles.map((article) => article.manifestKey));
  const missing = guideEntries
    .map((entry, index) => manifestKey(entry, index))
    .filter((key) => !foundKeys.has(key));
  fail(`Missing guide entries: ${missing.join(', ')}`);
}

await mkdir(outputDir, { recursive: true });

for (const article of orderedArticles) {
  if (!rebuildFromHtml || article.source === 'local') {
    const html = renderArticlePage(article);
    await writeGuideFile(article.outputPath, html);
    for (const legacyPath of article.legacyPaths) {
      await writeGuideFile(legacyPath, html);
    }
  }
}

await writeFile(path.join(outputDir, 'index.html'), renderGuidesIndex(orderedArticles));
for (const language of languageGroups(orderedArticles).keys()) {
  await writeGuideFile(`${language}/index.html`, renderGuidesIndex(orderedArticles, language));
}
await writeFile(path.join(repoRoot, 'html', 'sitemap.xml'), renderSitemap(orderedArticles));
await writeFile(path.join(outputDir, 'sitemap.xml'), renderGuidesSitemap(orderedArticles));
await writeFile(path.join(repoRoot, 'html', 'robots.txt'), renderRobots());

console.log(`Exported ${orderedArticles.length} GEOFlow guide pages to ${outputDir}`);

function loadGuideEntries() {
  const manifestArg = args.get('manifest');
  const manifestPath = manifestArg ? path.resolve(repoRoot, manifestArg) : defaultManifestPath;
  if (!args.has('ids')) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      return manifest.articles.map((entry) => ({
        ...entry,
        id: Number.isFinite(Number(entry.id)) ? Number(entry.id) : undefined,
        lang: entry.lang || 'en',
        group: entry.group || `article-${entry.id}`,
        legacyPaths: entry.legacyPaths || [],
      }));
    } catch (error) {
      if (manifestArg) {
        fail(`Unable to read manifest ${manifestPath}: ${error.message}`);
      }
    }
  }

  return (args.get('ids') || defaultArticleIds.join(','))
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter(Number.isFinite)
    .map((id) => ({ id, lang: 'en', group: `article-${id}`, legacyPaths: [] }));
}

async function loadArticles(entries) {
  const geoflowEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => Number.isFinite(entry.id) && !entry.sourcePath);
  const localEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.sourcePath);

  const geoflowArticles = geoflowEntries.length > 0 ? await fetchGeoflowEntryArticles(geoflowEntries) : [];
  const localArticles = localEntries.map(({ entry, index }) => loadLocalArticle(entry, index));
  return [...geoflowArticles, ...localArticles];
}

async function fetchGeoflowEntryArticles(entries) {
  const ids = entries.map(({ entry }) => entry.id);
  const { articles: fetchedArticles, source } = fetchArticles(ids);
  if (snapshotOutputPath && source === 'docker') {
    await writeSnapshot(snapshotOutputPath, fetchedArticles);
  }

  return fetchedArticles.map((article) => {
    const entry = entryById.get(Number(article.id));
    return normalizeArticle(article, entry);
  });
}

async function writeGuideFile(relativePath, html) {
  const target = path.join(outputDir, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
}

function fetchArticles(ids) {
  const articlesJsonArg = args.get('articles-json');
  if (articlesJsonArg) {
    const snapshotPath = path.resolve(repoRoot, articlesJsonArg);
    let snapshot;
    try {
      snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    } catch (error) {
      fail(`Unable to read --articles-json snapshot ${snapshotPath}: ${error.message}`);
    }

    if (!Array.isArray(snapshot)) {
      fail(`--articles-json snapshot must be a JSON array of article objects: ${snapshotPath}`);
    }

    const wanted = new Set(ids);
    const filtered = snapshot.filter((article) => wanted.has(Number(article?.id)));
    return { articles: filtered, source: 'snapshot' };
  }

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
    fail(
      [
        `Failed to run Docker Compose: ${result.error.message}`,
        '',
        'If you cannot access Docker from this environment, export can also run from an offline snapshot:',
        '  node scripts/export_geoflow_guides.mjs --articles-json=path/to/articles.json',
      ].join('\n'),
    );
  }

  if (result.status !== 0) {
    fail(
      [
        'Failed to read GEOFlow articles.',
        'Make sure Docker is running and start GEOFlow with:',
        '  cd deployments/GEOFlow',
        '  docker compose up -d --no-build',
        '',
        'If Docker is not available, pass a pre-exported snapshot:',
        '  node scripts/export_geoflow_guides.mjs --articles-json=path/to/articles.json',
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  const payload = result.stdout.trim();
  try {
    return { articles: JSON.parse(payload), source: 'docker' };
  } catch (error) {
    fail(`GEOFlow returned invalid JSON: ${error.message}\n${payload}`);
  }
}

async function writeSnapshot(outputPath, articles) {
  const resolved = path.resolve(repoRoot, outputPath);
  try {
    const serialized = JSON.stringify(articles, null, 2);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, serialized);
  } catch (error) {
    fail(`Failed to write snapshot ${resolved}: ${error.message}`);
  }
}

function loadLocalArticle(entry, index) {
  if (!entry.sourcePath) {
    fail(`Manifest entry ${manifestKey(entry, index)} needs either id or sourcePath.`);
  }
  const sourcePath = path.resolve(repoRoot, entry.sourcePath);
  let raw;
  try {
    raw = readFileSync(sourcePath, 'utf8');
  } catch (error) {
    fail(`Unable to read local article ${sourcePath}: ${error.message}`);
  }

  const parsed = parseFrontMatter(raw);
  return normalizeArticle(
    {
      manifestKey: manifestKey(entry, index),
      source: 'local',
      title: entry.title || parsed.data.title,
      description: entry.description || parsed.data.description,
      keywords: entry.keyword || parsed.data.keyword || parsed.data.keywords,
      content: parsed.body,
      slug: entry.slug || parsed.data.slug,
      group: entry.group || parsed.data.group,
      lang: entry.lang || parsed.data.lang,
      updated_at: new Date().toISOString(),
    },
    entry,
  );
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

async function buildArticlesFromExistingHtml(entries) {
  const articles = [];
  for (const [index, entry] of entries.entries()) {
    if (entry.sourcePath) {
      articles.push(loadLocalArticle(entry, index));
      continue;
    }

    const lang = entry.lang || 'en';
    const staticSlug = entry.slug || `guide-${entry.id}`;
    const outputPath = entry.path || `${lang}/${staticSlug}.html`;
    const filePath = path.join(outputDir, outputPath);
    let html;
    try {
      html = readFileSync(filePath, 'utf8');
    } catch (error) {
      fail(
        [
          `Unable to rebuild from HTML: missing ${filePath}`,
          'Run a full export (Docker or --articles-json snapshot) at least once before using --rebuild-from-html.',
        ].join('\n'),
      );
    }

    const title = decodeHtml(extractTagValue(html, 'title')).replace(/\s*\|\s*PetTomo Guides\s*$/, '').trim();
    const description = decodeHtml(extractMetaContent(html, 'description'));
    const fileStats = await stat(filePath);

    articles.push({
      id: Number(entry.id),
      manifestKey: manifestKey(entry, index),
      source: 'html',
      title: title || `PetTomo Guide ${entry.id}`,
      description: description || '',
      keywords:
        'PetTomo, shared virtual pet app, virtual pet, shared pet room, photo feeding, couples virtual pet app',
      lang,
      group: entry.group || `article-${entry.id}`,
      staticSlug,
      outputPath,
      legacyPaths: entry.legacyPaths || [],
      canonicalUrl: `${baseUrl}/guides/${outputPath}`,
      updatedAt: fileStats.mtime.toISOString(),
      content: '',
    });
  }
  return articles;
}

function extractTagValue(html, tagName) {
  const match = String(html || '').match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractMetaContent(html, name) {
  const match = String(html || '').match(
    new RegExp(`<meta\\s+[^>]*name=[\"']${name}[\"'][^>]*content=[\"']([^\"']*)[\"'][^>]*>`, 'i'),
  );
  return match ? match[1].trim() : '';
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function normalizeArticle(article, entry = {}) {
  const content = stripDuplicateTitleHeading(article.content || '', article.title || '');
  const plainText = markdownToPlainText(content || article.excerpt || '');
  const leadText = extractLeadText(content) || plainText;
  const description = cleanMetaDescription(article.meta_description || article.description, leadText);
  const staticSlug = entry.slug || article.slug || slugify(article.title || `guide-${article.id || entry.group}`);
  const keywords = normalizeKeywords(article, plainText);
  const lang = entry.lang || 'en';
  const outputPath = entry.path || `${lang}/${staticSlug}.html`;

  return {
    ...article,
    title: String(article.title || `PetTomo Guide ${article.id}`).trim(),
    content,
    manifestKey: article.manifestKey || entry.manifestKey,
    source: article.source || 'geoflow',
    staticSlug,
    lang,
    group: entry.group || `article-${article.id}`,
    outputPath,
    legacyPaths: entry.legacyPaths || [],
    description,
    keywords,
    canonicalUrl: `${baseUrl}/guides/${outputPath}`,
    updatedAt: article.updated_at || article.published_at || article.created_at || new Date().toISOString(),
  };
}

function manifestKey(entry, index) {
  if (Number.isFinite(entry.id) && !entry.sourcePath) {
    return `id:${entry.id}`;
  }
  return [
    'local',
    entry.group || `entry-${index}`,
    entry.lang || 'en',
    entry.slug || entry.sourcePath || index,
  ].join(':');
}

function stripDuplicateTitleHeading(markdown, title) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const firstMeaningfulIndex = lines.findIndex((line) => line.trim());
  if (firstMeaningfulIndex === -1) return '';

  const first = lines[firstMeaningfulIndex].trim();
  const normalizedTitle = String(title || '').trim().toLowerCase();
  if (first.toLowerCase() === `# ${normalizedTitle}`) {
    lines.splice(firstMeaningfulIndex, 1);
  }

  return lines.join('\n').trim();
}

function extractLeadText(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('|')) continue;
    if (/^[-*]\s+/.test(trimmed)) continue;
    if (/^\d+\.\s+/.test(trimmed)) continue;
    if (trimmed.length < 90) continue;
    return markdownToPlainText(trimmed);
  }
  return '';
}

function cleanMetaDescription(metaDescription, plainText) {
  const meta = String(metaDescription || '').replace(/\s+/g, ' ').trim();
  if (isUsableMetaDescription(meta)) {
    return truncateSentence(meta, 155);
  }
  return truncateSentence(String(plainText || '').replace(/\s+/g, ' '), 155);
}

function isUsableMetaDescription(value) {
  if (value.length < 35 || value.length > 170) return false;
  if (/\b(and|or|the|with|for|to|from|through)$/i.test(value)) return false;
  return /[.!?。？！]$/.test(value);
}

function normalizeKeywords(article, plainText) {
  const existing = String(article.keywords || '')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  const fallback = ['PetTomo', 'shared virtual pet app', 'virtual pet', 'shared pet room'];
  const titleAndText = `${article.title || ''} ${plainText}`.toLowerCase();

  if (titleAndText.includes('photo')) fallback.push('photo feeding');
  if (titleAndText.includes('couple')) fallback.push('couples virtual pet app');
  if (titleAndText.includes('friend')) fallback.push('friends virtual pet app');
  if (titleAndText.includes('shared room')) fallback.push('shared rooms');
  if (titleAndText.includes('different')) fallback.push('virtual pet apps');

  return Array.from(new Set([...existing, ...fallback])).join(', ');
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function renderArticlePage(article) {
  const articleHtml = renderMarkdown(article.content);
  const alternates = alternateLinks(article);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    author: {
      '@type': 'Organization',
      name: 'PetTomo',
    },
    publisher: {
      '@type': 'Organization',
      name: 'PetTomo',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/assets/PetTomo_appicon.png`,
      },
    },
    mainEntityOfPage: article.canonicalUrl,
    dateModified: article.updatedAt,
  };

  return pageShell({
    title: `${article.title} | PetTomo Guides`,
    description: article.description,
    keywords: article.keywords,
    canonicalUrl: article.canonicalUrl,
    lang: article.lang,
    alternates,
    bodyClass: 'article-page',
    main: `
      <main class="article-shell">
        <p class="eyebrow"><a href="/guides/">PetTomo Guides</a></p>
        <article class="article">
          <h1>${escapeHtml(article.title)}</h1>
          <p class="article-summary">${escapeHtml(article.description)}</p>
          <div class="article-meta">Updated ${formatDate(article.updatedAt)}</div>
          <div class="article-content">
            ${articleHtml}
          </div>
        </article>
        <nav class="article-nav" aria-label="Guide navigation">
          <a href="/guides/">All guides</a>
          <a href="/guides/${article.lang}/">This language</a>
          <a href="/">PetTomo home</a>
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
      (article) => `<a class="guide-card" href="/guides/${article.outputPath}">
          <span class="guide-label">${escapeHtml(languageLabel(article.lang))}</span>
          <h2>${escapeHtml(article.title)}</h2>
          <p>${escapeHtml(article.description)}</p>
        </a>`,
    )
    .join('\n');

  const title = language
    ? `PetTomo ${languageLabel(language)} Guides | Shared Virtual Pet App Tips`
    : 'PetTomo Guides | Shared Virtual Pet App Tips';
  const description = language
    ? `PetTomo ${languageLabel(language)} guides about shared virtual pets, couples, friends, rooms, and photo feeding.`
    : 'SEO-friendly PetTomo guides about shared virtual pets, rooms, couples, friends, and photo feeding.';

  return pageShell({
    title,
    description,
    keywords:
      'PetTomo, shared virtual pet app, virtual pet, shared pet room, photo feeding, couples virtual pet app',
    canonicalUrl: language ? `${baseUrl}/guides/${language}/` : `${baseUrl}/guides/`,
    lang: language || 'en',
    alternates: languageIndexAlternates(articles),
    bodyClass: 'guides-page',
    main: `
      <main class="guides-shell">
        <section class="guides-hero">
          <div>
            <p class="eyebrow">PetTomo Guides</p>
            <h1>${escapeHtml(language ? `${languageLabel(language)} PetTomo guides` : 'Shared virtual pet guides for PetTomo users')}</h1>
            <p>${escapeHtml(description)}</p>
          </div>
          <img src="/assets/PetTomo_appicon.png" alt="PetTomo app icon">
        </section>
        <section class="guide-grid" aria-label="PetTomo guide articles">
          ${cards}
        </section>
      </main>
    `,
  });
}

function renderSitemap(articles) {
  const staticPages = [
    ['', 'daily'],
    ['index_en.html', 'monthly'],
    ['support.html', 'monthly'],
    ['privacy_policy.html', 'yearly'],
    ['terms_of_use.html', 'yearly'],
    ['guides/', 'weekly'],
    ...Array.from(languageGroups(articles).keys()).map((language) => [`guides/${language}/`, 'weekly']),
    ...articles.flatMap((article) => [
      [`guides/${article.outputPath}`, 'weekly'],
      ...article.legacyPaths.map((legacyPath) => [`guides/${legacyPath}`, 'weekly']),
    ]),
  ];

  const urls = staticPages
    .map(([location, changefreq]) => {
      const loc = `${baseUrl}/${location}`.replace(/\/$/, location === '' ? '/' : '/');
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

function renderGuidesSitemap(articles) {
  const guidePages = [
    ['guides/', 'weekly'],
    ...Array.from(languageGroups(articles).keys()).map((language) => [`guides/${language}/`, 'weekly']),
    ...articles.flatMap((article) => [
      [`guides/${article.outputPath}`, 'weekly'],
      ...article.legacyPaths.map((legacyPath) => [`guides/${legacyPath}`, 'weekly']),
    ]),
  ];

  return renderUrlset(guidePages);
}

function renderRobots() {
  return `User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/guides/sitemap.xml
`;
}

function renderUrlset(pages) {
  const urls = pages
    .map(([location, changefreq]) => {
      const loc = `${baseUrl}/${location}`.replace(/\/$/, location === '' ? '/' : '/');
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

function languageGroups(articles) {
  const groups = new Map();
  for (const article of articles) {
    if (!groups.has(article.lang)) {
      groups.set(article.lang, []);
    }
    groups.get(article.lang).push(article);
  }
  return groups;
}

function alternateLinks(article) {
  return orderedArticles
    .filter((candidate) => candidate.group === article.group)
    .map((candidate) => ({
      lang: candidate.lang,
      href: candidate.canonicalUrl,
    }));
}

function languageIndexAlternates(articles) {
  return Array.from(languageGroups(articles).keys()).map((language) => ({
    lang: language,
    href: `${baseUrl}/guides/${language}/`,
  }));
}

function languageLabel(language) {
  return {
    en: 'English',
    'zh-hant': '繁體中文',
    'zh-hans': '简体中文',
    ja: '日本語',
    ko: '한국어',
  }[language] || language;
}

function pageShell({ title, description, keywords, canonicalUrl, lang = 'en', alternates = [], bodyClass, main }) {
  const alternateHead = alternates
    .map((alternate) => `  <link rel="alternate" hreflang="${escapeHtml(alternate.lang)}" href="${escapeHtml(alternate.href)}">`)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
${alternateHead}
  <link rel="alternate" hreflang="x-default" href="${baseUrl}/guides/">
  <link rel="icon" type="image/png" href="/assets/PetTomo_appicon.png">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${baseUrl}/assets/PetTomo_appicon.png">
  <style>
    :root {
      --primary: #5FBF9E;
      --secondary: #FFB36B;
      --bg: #FFFBF3;
      --panel: #FFFFFF;
      --text: #2F2A23;
      --muted: #756B61;
      --line: #E7DED2;
      --soft: #F4FAF8;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.7;
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
      font-size: 1.25rem;
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
      min-height: 320px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 160px;
      gap: 40px;
      align-items: center;
      padding: 54px 0 40px;
      border-bottom: 1px solid var(--line);
    }

    .guides-hero img {
      width: 144px;
      height: 144px;
      border-radius: 32px;
      box-shadow: 0 16px 34px rgba(47, 42, 35, 0.12);
    }

    .eyebrow,
    .guide-label {
      margin: 0 0 12px;
      color: var(--primary);
      font-size: 0.82rem;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1 {
      max-width: 820px;
      margin: 0;
      font-size: clamp(2.25rem, 6vw, 4.25rem);
      line-height: 1.06;
      letter-spacing: 0;
    }

    .guides-hero p:not(.eyebrow),
    .article-summary {
      max-width: 760px;
      margin: 22px 0 0;
      color: var(--muted);
      font-size: 1.12rem;
    }

    .guide-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
      padding-top: 34px;
    }

    .guide-card {
      min-height: 238px;
      padding: 24px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      text-decoration: none;
      box-shadow: 0 10px 24px rgba(47, 42, 35, 0.06);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .guide-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 16px 32px rgba(47, 42, 35, 0.1);
    }

    .guide-card h2 {
      margin: 0;
      font-size: 1.26rem;
      line-height: 1.25;
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
      line-height: 1.2;
      letter-spacing: 0;
    }

    .article-content h2 { font-size: 1.72rem; }
    .article-content h3 { font-size: 1.28rem; }

    .article-content p,
    .article-content ul,
    .article-content ol,
    .article-content table {
      margin: 0 0 18px;
    }

    .article-content ul,
    .article-content ol {
      padding-left: 24px;
    }

    .article-content li + li {
      margin-top: 7px;
    }

    .article-content table {
      width: 100%;
      border-collapse: collapse;
      display: block;
      overflow-x: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }

    .article-content th,
    .article-content td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    .article-content th {
      background: var(--soft);
      font-weight: 800;
    }

    .article-content blockquote {
      margin: 24px 0;
      padding: 18px 20px;
      border-left: 4px solid var(--secondary);
      background: var(--panel);
      border-radius: 0 8px 8px 0;
      color: var(--muted);
    }

    .article-nav {
      max-width: 860px;
      margin: 24px auto 0;
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }

    .article-nav a {
      padding: 10px 16px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      color: var(--text);
      font-weight: 800;
      text-decoration: none;
    }

    .site-footer {
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.92rem;
      flex-wrap: wrap;
    }

    .site-footer nav {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    @media (max-width: 720px) {
      .site-header {
        align-items: flex-start;
        flex-direction: column;
      }

      .site-nav {
        flex-wrap: wrap;
      }

      .guides-hero {
        grid-template-columns: 1fr;
        gap: 24px;
        padding-top: 28px;
      }

      .guides-hero img {
        width: 104px;
        height: 104px;
        border-radius: 24px;
      }

      h1 {
        font-size: 2.3rem;
      }
    }
  </style>
</head>
<body class="${escapeHtml(bodyClass)}">
  <header class="site-header">
    <a class="brand" href="/">
      <img src="/assets/PetTomo_appicon.png" alt="" aria-hidden="true">
      <span>PetTomo</span>
    </a>
    <nav class="site-nav" aria-label="Main navigation">
      <a href="/guides/">Guides</a>
      <a href="/support.html">Support</a>
      <a href="/">Home</a>
    </nav>
  </header>
  ${main}
  <footer class="site-footer">
    <span>© ${new Date().getFullYear()} hangyodev</span>
    <nav aria-label="Footer navigation">
      <a href="/guides/">Guides</a>
      <a href="/support.html">Support</a>
      <a href="/privacy_policy.html">Privacy Policy</a>
      <a href="/terms_of_use.html">Terms of Use</a>
    </nav>
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
  let inBlockquote = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  const closeBlockquote = () => {
    if (!inBlockquote) return;
    html.push('</blockquote>');
    inBlockquote = false;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      closeBlockquote();
      continue;
    }

    const table = collectTable(lines, index);
    if (table) {
      flushParagraph();
      closeList();
      closeBlockquote();
      html.push(renderTable(table.rows));
      index = table.end;
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      closeBlockquote();
      const level = Math.min(heading[1].length, 3);
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      flushParagraph();
      closeList();
      if (!inBlockquote) {
        html.push('<blockquote>');
        inBlockquote = true;
      }
      html.push(`<p>${renderInline(trimmed.slice(2))}</p>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      closeBlockquote();
      const nextType = bullet ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        html.push(`<${nextType}>`);
        listType = nextType;
      }
      html.push(`<li>${renderInline((bullet || numbered)[1])}</li>`);
      continue;
    }

    closeList();
    closeBlockquote();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  closeBlockquote();

  return html.join('\n');
}

function collectTable(lines, startIndex) {
  const first = lines[startIndex].trim();
  const second = lines[startIndex + 1]?.trim();
  if (!isTableRow(first) || !isTableSeparator(second)) {
    return null;
  }

  const rows = [first];
  let index = startIndex + 2;
  while (index < lines.length && isTableRow(lines[index].trim())) {
    rows.push(lines[index].trim());
    index += 1;
  }

  return { rows, end: index - 1 };
}

function isTableRow(line) {
  return line.startsWith('|') && line.endsWith('|') && line.includes('|', 1);
}

function isTableSeparator(line) {
  return Boolean(line && /^\|[\s:-]+\|$/.test(line.replace(/[^|:-]/g, '')));
}

function renderTable(rows) {
  const header = splitTableRow(rows[0]);
  const body = rows.slice(1).map(splitTableRow);
  const headHtml = header.map((cell) => `<th>${renderInline(cell)}</th>`).join('');
  const bodyHtml = body
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<table>
  <thead><tr>${headHtml}</tr></thead>
  <tbody>${bodyHtml}</tbody>
</table>`;
}

function splitTableRow(row) {
  return row
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function renderInline(value) {
  let html = escapeHtml(value);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" rel="noopener noreferrer">$1</a>',
  );
  return html;
}

function markdownToPlainText(markdown) {
  return String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[#>*_|\-]/g, ' ')
    .replace(/\d+\.\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateSentence(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(
    clipped.lastIndexOf('.'),
    clipped.lastIndexOf('!'),
    clipped.lastIndexOf('?'),
  );
  if (sentenceEnd > 80) return clipped.slice(0, sentenceEnd + 1).trim();
  return `${clipped.slice(0, maxLength - 1).replace(/\s+\S*$/, '').trim()}...`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
