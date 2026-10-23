import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(file, 'utf8');
const manifest = JSON.parse(read(path.join(root, 'scripts/geoflow_guides_manifest.json')));
const run = (dir) => spawnSync(process.execPath, [path.join(dir, 'scripts/export_geoflow_guides.mjs')], { encoding: 'utf8' });

test('every published page has consistent metadata, crawlable links and factual copy guardrails', () => {
  const htmlRoot = path.join(root, 'html');
  const files = readdirSync(htmlRoot, { recursive: true }).filter((file) => file.endsWith('.html'));
  const sitemap = read(path.join(htmlRoot, 'sitemap.xml'));
  const titles = new Set();
  const descriptions = new Set();
  for (const file of files) {
    const html = read(path.join(htmlRoot, file));
    const urlPath = file === 'index.html' ? '' : file.replace(/index\.html$/, '');
    const isAlias = file === 'guides/ja/index.html';
    const canonical = `https://www.kairogu.men/${isAlias ? 'guides/' : urlPath}`;
    assert.match(html, /<html lang="ja">/, file);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, file);
    assert.doesNotMatch(html, /<h3>[^<]+<\/h3>\s*<h[23]>/, `empty section: ${file}`);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`), file);
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), file);
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
    const description = /<meta name="description" content="([^"]+)">/.exec(html)?.[1];
    if (!isAlias) {
      assert.ok(title && !titles.has(title), `unique title: ${file}`);
      assert.ok(description && !descriptions.has(description), `unique description: ${file}`);
      titles.add(title); descriptions.add(description);
    }
    const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, '');
    assert.doesNotMatch(text, /入力ゼロ|入力不要|ローカル|1\.5\.[012]|Gemini 1\.5 Flash|20日以内/, file);
    assert.doesNotMatch(text, /内容量と単位を確認・修正できます|内容量や単位を直します|数量を増やす|どちらの基準で自分の価格履歴を見たい/, `unsupported controls: ${file}`);
    assert.doesNotMatch(html, /<meta[^>]+content="[^"]*(?:noindex|nosnippet)/, file);
    for (const [, link] of html.matchAll(/<(?:a|img)\b[^>]*(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|#)/.test(link)) continue;
      const target = path.resolve(path.dirname(path.join(htmlRoot, file)), link.startsWith('/') ? `${htmlRoot}${link}` : link.split('#')[0]);
      assert.ok(existsSync(target.endsWith('/') ? `${target}index.html` : target), `${file}: ${link}`);
    }
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const data = JSON.parse(json);
      assert.equal(data['@context'], 'https://schema.org');
      if (data['@type'] === 'Article') {
        assert.equal(data.mainEntityOfPage, canonical);
        assert.ok(html.includes(`datetime="${data.dateModified}"`), file);
        assert.ok(html.includes(data.author.name), file);
      }
    }
  }
  for (const entry of manifest.articles) {
    const html = read(path.join(htmlRoot, 'guides', entry.lang, `${entry.slug}.html`));
    assert.match(html, /<h2>関連ガイド<\/h2>/);
    assert.ok((html.match(/<a href="\/guides\/ja\//g) || []).length >= 2, entry.slug);
    if (html.includes('近くの価格')) assert.match(html, /カイログ Pro|カイログ\s*Pro/);
  }
  const compare = read(path.join(htmlRoot, 'guides/ja/unit-price-comparison.html'));
  assert.match(compare, /無料の計算機/);
  assert.doesNotMatch(compare, /既存の記録から選択|数量・価格・割引を入力|節約額も表示/);
  assert.match(read(path.join(htmlRoot, 'robots.txt')), /User-agent: \*\nAllow: \/\n/);
});

test('export dates are stable, local links render safely and invalid dates fail', (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'kairogu-export-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  mkdirSync(path.join(dir, 'html'));
  cpSync(path.join(root, 'docs/articles'), path.join(dir, 'docs/articles'), { recursive: true });
  cpSync(path.join(root, 'vercel.json'), path.join(dir, 'vercel.json'));
  for (const file of ['export_geoflow_guides.mjs', 'geoflow_guides_manifest.json']) cpSync(path.join(root, 'scripts', file), path.join(dir, 'scripts', file));
  const config = JSON.parse(read(path.join(dir, 'vercel.json')));
  const retired = config.redirects.filter((rule) => rule.source.endsWith('.html'));
  mkdirSync(path.join(dir, 'html/guides/ja'), { recursive: true });
  for (const rule of retired) writeFileSync(path.join(dir, 'html', rule.source.slice(1)), 'stale article');
  const first = run(dir);
  assert.equal(first.status, 0, first.stderr);
  for (const rule of retired) assert.ok(!existsSync(path.join(dir, 'html', rule.source.slice(1))), rule.source);
  for (const file of readdirSync(path.join(dir, 'html'), { recursive: true }).filter((file) => /\.(html|xml|txt)$/.test(file))) {
    assert.equal(read(path.join(dir, 'html', file)), read(path.join(root, 'html', file)), `committed output matches source: ${file}`);
  }
  const output = path.join(dir, 'html/guides/ja/price-recording-app.html');
  const before = read(output);
  assert.equal(run(dir).status, 0);
  assert.equal(read(output), before);
  const source = path.join(dir, manifest.articles[0].sourcePath);
  writeFileSync(source, `${read(source)}\n[<script>bad</script>](/guides/ja/unit-price-comparison.html) [unsafe](javascript:alert(1))\n`);
  assert.equal(run(dir).status, 0);
  const html = read(output);
  assert.ok(html.includes('<a href="/guides/ja/unit-price-comparison.html">&lt;script&gt;bad&lt;/script&gt;</a>'));
  assert.ok(!html.includes('href="javascript:'));
  writeFileSync(source, read(source).replace('updated: 2026-10-23', 'updated: invalid'));
  const invalid = run(dir);
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /valid editorial updated date/);
});


test('consolidated routes are permanent, direct, absent from output and cannot be resurrected', (t) => {
  const config = JSON.parse(read(path.join(root, 'vercel.json')));
  const redirects = config.redirects;
  const retired = redirects.filter((rule) => rule.source.endsWith('.html'));
  const activePaths = manifest.articles.map((entry) => `/guides/${entry.lang}/${entry.slug}.html`);
  const guideRoot = path.join(root, 'html/guides/ja');
  assert.equal(new Set(redirects.map((rule) => rule.source)).size, redirects.length, 'unique redirect sources');
  assert.deepEqual(readdirSync(guideRoot).filter((file) => file !== 'index.html').sort(), activePaths.map((url) => path.basename(url)).sort());
  for (const protectedPath of ['/', '/guides/ja/price-recording-app.html', '/guides/ja/ocr-price-recording-checkpoints.html']) {
    assert.ok(!redirects.some((rule) => rule.source === protectedPath), protectedPath);
  }
  const rootSitemap = read(path.join(root, 'html/sitemap.xml'));
  const guideSitemap = read(path.join(root, 'html/guides/sitemap.xml'));
  const index = read(path.join(root, 'html/guides/index.html'));
  const jaIndex = read(path.join(root, 'html/guides/ja/index.html'));
  const expectedGuides = ['/guides/', ...activePaths];
  const locs = (xml) => [...xml.matchAll(/<loc>https:\/\/www\.kairogu\.men([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs(guideSitemap).sort(), expectedGuides.sort());
  assert.equal(locs(rootSitemap).length, new Set(locs(rootSitemap)).size);
  for (const url of activePaths) {
    assert.ok(rootSitemap.includes(`<loc>https://www.kairogu.men${url}</loc>`), url);
    assert.ok(index.includes(`href="${url}"`), url);
    assert.ok(jaIndex.includes(`href="${url}"`), url);
  }
  for (const rule of retired) {
    assert.equal(rule.permanent, true, rule.source);
    assert.ok(activePaths.includes(rule.destination), rule.destination);
    assert.ok(!redirects.some((next) => next.source === rule.destination), 'no chains');
    assert.ok(!activePaths.includes(rule.source), rule.source);
    assert.ok(!existsSync(path.join(root, 'docs/articles', `${path.basename(rule.source, '.html')}-ja.md`)), rule.source);
    for (const sitemap of [rootSitemap, guideSitemap]) assert.ok(!sitemap.includes(rule.source), rule.source);
  }
  for (const file of readdirSync(path.join(root, 'html'), { recursive: true }).filter((file) => file.endsWith('.html'))) {
    const html = read(path.join(root, 'html', file));
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
      const url = new URL(href, 'https://www.kairogu.men/');
      if (url.origin === 'https://www.kairogu.men') assert.ok(!retired.some((rule) => rule.source === url.pathname), `${file}: ${href}`);
    }
  }
  const dir = mkdtempSync(path.join(os.tmpdir(), 'kairogu-redirect-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(path.join(root, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  cpSync(path.join(root, 'docs/articles'), path.join(dir, 'docs/articles'), { recursive: true });
  const badRule = config.redirects.find((rule) => rule.source.endsWith('.html'));
  const originalDestination = badRule.destination;
  badRule.destination = '/guides/ja/missing.html';
  writeFileSync(path.join(dir, 'vercel.json'), JSON.stringify(config));
  const missing = run(dir);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /permanent redirect to an active guide/);
  badRule.destination = originalDestination;
  writeFileSync(path.join(dir, 'vercel.json'), JSON.stringify(config));
  const resurrected = structuredClone(manifest);
  resurrected.articles.push({ ...manifest.articles[0], slug: path.basename(badRule.source, '.html') });
  writeFileSync(path.join(dir, 'scripts/geoflow_guides_manifest.json'), JSON.stringify(resurrected));
  const conflict = run(dir);
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /permanent redirect to an active guide/);
});
