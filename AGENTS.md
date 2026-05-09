# AGENTS.md

Instructions for agents working in this GEO marketing workspace.

## Purpose

This workspace is not a product app repo. It is for GEOFlow-based content
operations, multilingual SEO/GEO publishing, Firebase Hosting static sites, and
marketing workflows across multiple apps.

## Core Rules

- Do not mix app runtime code with marketing content operations.
- Treat `shared/GEOFlow` as the local CMS/content database.
- Treat each `projects/<app>/` folder as that app's publishing unit.
- Do not hand-edit generated files under `projects/<app>/html/guides/`; update
  GEOFlow records and the app manifest, then rerun the export script.
- For priority content, default to:

```text
1 topic = 5 language pages = 1 hreflang group
```

- Supported default languages: `en`, `zh-hant`, `zh-hans`, `ja`, `ko`.
- Use `shared/docs/geoflow_content_workflow.md` before creating, translating,
  optimizing, exporting, or deploying content.

## Verification

Before deploying a project:

```sh
node --check scripts/export_geoflow_guides.mjs
git diff --check
```

If the project folder is copied from a Flutter app repo and still contains app
checks in its workflow notes, run those checks from the app repo, not from this
marketing workspace.

After deploy:

```sh
curl -I <site-url>/guides/
curl -I <site-url>/sitemap.xml
```

Report any Search Console work as `[USER ACTION REQUIRED]`.
