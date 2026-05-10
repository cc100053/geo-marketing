# Deprecated

This directory is a legacy copy of the カイログ static website and is not a
deployment source.

The production source of truth is:

```text
/Users/fatboy/geo-marketing/projects/kairogu/html/
```

Vercel serves `html/` through:

```text
/Users/fatboy/geo-marketing/projects/kairogu/vercel.json
```

Do not edit, sync, or deploy this `web-landing/` directory. Keeping a Vercel
config here would create a second deploy entry point and can drift from the live
site, so this directory intentionally has no `vercel.json`.
