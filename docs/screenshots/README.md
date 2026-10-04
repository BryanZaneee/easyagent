# README screenshots

Captured from [https://bryanzane.com/easyagent/](https://bryanzane.com/easyagent/) in a fresh, signed-out Chromium session.
These are public production pages and their real assets, with no mocked responses.
The live deployment can differ from the current checkout. Captured October 4, 2026.

```sh
cd docs/screenshots && npm ci && npx playwright install chromium && npm run capture
```

Requires Node.js, network access, and `cwebp` (libwebp). No local app server is needed.
The script uses a 1440 × 960 viewport, waits for visible images and fonts, and
writes WebP files below 300 KB. It does not sign in, publish content, or submit
AI prompts. Any typed text is a disposable sample. Public content can change
between captures.

Before publishing a recapture, inspect the final image for relevant content,
coarse or hateful text, explicit imagery, personal contact details, account data,
and error states. Live content can change; a successful capture is not a content
review. README images are static files and do not refresh from the site.
