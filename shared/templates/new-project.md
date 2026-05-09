# New App GEO Project Template

Create one folder per app:

```text
projects/<app-slug>/
  docs/
  html/
  scripts/
  deployments/GEOFlow -> ../../../shared/GEOFlow
  firebase.json
  .firebaserc
```

## Required Setup

1. Add the app's static marketing site under `html/`.
2. Add Firebase Hosting config:
   - `firebase.json`
   - `.firebaserc`
3. Copy/adapt `projects/pettomo/scripts/export_geoflow_guides.mjs`.
4. Create `scripts/geoflow_guides_manifest.json`.
5. Add product facts:
   - What the app does
   - Supported languages
   - Target markets
   - Claims to avoid
   - Conversion goal
6. Create GEOFlow title/keyword/task/article records.
7. Export and deploy only after review.

## Default Content Rule

```text
1 topic = 5 language pages = 1 hreflang group
```

Supported default languages:

- `en`
- `zh-hant`
- `zh-hans`
- `ja`
- `ko`
