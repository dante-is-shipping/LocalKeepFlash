# Contributing

LocalKeepFlash accepts contributions under AGPL-3.0-only using the Developer Certificate of Origin (DCO). Sign commits with `git commit -s` to certify that you have the right to submit the contribution.

Before opening a pull request:

```bash
npm ci
npm run check
```

Keep the product local-first. New code must not add accounts, telemetry, remote executable code, a KeepFlash API dependency, or a second persistence database. User-facing text must be provided in English and Simplified Chinese.

Tests should observe public behavior at these seams:

- page or selection input to extracted capture;
- capture to portable Markdown;
- capture plus selected directory to save result;
- onboarding and permission recovery as a user flow.
