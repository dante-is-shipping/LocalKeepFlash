# LocalKeepFlash

LocalKeepFlash is a local-first Chromium web clipper. It saves readable pages, exact selections, images, and YouTube transcripts directly into a folder you choose as portable Markdown and local assets.

There is no account, KeepFlash API, cloud database, analytics, AI service, or local daemon in the saving path.

> Status: `0.1.0` is an early open-source release. YouTube extraction relies on interfaces owned by YouTube and may need maintenance when those interfaces change.

## What it saves

- Readable article content with headings, links, lists, tables, quotes, and code.
- Exact text selections with canonical and text-fragment URLs when available.
- Images as the original raster file plus a searchable Markdown note.
- YouTube metadata, cover image, chapters, and timestamped captions.

Unsupported in `0.1.0`: PDF viewers, `file://` URLs, browser-internal pages, and Incognito mode.

## Data layout

```text
chosen-folder/
├── notes/YYYY/MM/<timestamp--title--short-id>.md
├── assets/<clip-id>/<asset>
└── .local-keepflash/
    ├── schema.json
    └── pending/
```

Each note contains versioned YAML frontmatter. LocalKeepFlash never silently overwrites an earlier capture and never rewrites old notes during an extension update.

## Install for development

Requirements: Node.js 22+, npm, and Chrome or Edge 122+.

```bash
npm install
npm run dev
```

Load `.output/chrome-mv3` as an unpacked extension from the browser extensions page. On first install, LocalKeepFlash opens an onboarding tab where you choose the destination folder and preferred caption languages.

## Commands

```bash
npm run dev          # WXT development mode
npm run test         # Behavior tests
npm run typecheck    # TypeScript validation
npm run lint         # ESLint
npm run build        # Chrome MV3 production build
npm run zip          # Distribution zip
npm run check        # Full local release gate
```

## Permissions

LocalKeepFlash requests access to HTTP(S) websites so it can read a page only after you ask to save it and copy images that are hosted on other domains. The content is written to your selected directory. It is not sent to KeepFlash or another service.

YouTube saves may contact YouTube's own player and caption endpoints with credentials omitted. No third-party transcript proxy is used.

See [PRIVACY.md](PRIVACY.md) for the complete data boundary.

## Limits

- 25 MB per attachment.
- 100 MB of attachments per capture.
- 15 seconds per attachment request.
- 30 seconds for page or caption extraction requests.
- SVG images remain remote links because SVG can contain active content.

The chosen folder is not encrypted by LocalKeepFlash. Protect it using filesystem permissions and synchronization tools you trust.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

Copyright KeepFlash contributors.

LocalKeepFlash is licensed under the GNU Affero General Public License v3.0 only. KeepFlash names and commercial product assets are not granted as trademarks by the software license.
