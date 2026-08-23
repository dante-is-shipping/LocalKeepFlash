# Privacy Policy

Effective date: August 23, 2026

LocalKeepFlash processes captures in the browser and writes them to a directory selected by the user.

## Data handled by the extension

When the user explicitly asks LocalKeepFlash to save something, the extension processes the current page URL and website content needed to create the requested local copy. This can include article text, a selected passage, image URLs, page metadata, and YouTube video metadata or captions. LocalKeepFlash does not collect this information on behalf of the developer and does not transmit saved content to the developer or KeepFlash.

The extension stores the selected directory handle, interface language, caption language preferences, theme preference, and an incomplete-save intent in browser-local storage. These values remain on the user's device.

## Use and sharing

LocalKeepFlash uses page data only to provide its single purpose: saving a user-requested webpage, selection, image, or YouTube transcript as portable Markdown and local assets.

It does not:

- create an account;
- send captures to KeepFlash;
- use analytics, advertising, crash reporting, or tracking pixels;
- call an AI service;
- load executable code from a remote server;
- synchronize extension settings through Chrome Sync.

When the user saves a page, LocalKeepFlash reads that page and may request image resources referenced by it. Those asset requests use `credentials: omit`. YouTube captures may request YouTube-owned player and caption endpoints to obtain the selected video's captions.

LocalKeepFlash does not sell user data, use it for advertising or credit decisions, or allow humans to read it. It does not transfer user data to third parties. Requests to a source website are limited to retrieving resources needed for the user-requested capture.

The use of information received through Chrome APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data), including the Limited Use requirements.

## Retention and deletion

Saved content remains in the user-selected directory until the user deletes it. Browser-local settings and the stored directory permission remain until the user changes them, clears the extension's storage, or uninstalls the extension. Uninstalling LocalKeepFlash does not remove files from the selected directory.

Saved content is not encrypted by LocalKeepFlash. If the chosen folder is synchronized by another application, that application's privacy policy applies.

## Optional KeepFlash link

The onboarding page contains an optional link to the KeepFlash website. LocalKeepFlash does not send capture content or extension settings through this link. If the user chooses to open it, the website's own privacy policy applies.

## Contact

For privacy questions, open an issue in the [LocalKeepFlash GitHub repository](https://github.com/dante-is-shipping/LocalKeepFlash/issues). Do not include captured private content, credentials, directory listings, or personal data in a public issue. Security concerns should use [private vulnerability reporting](https://github.com/dante-is-shipping/LocalKeepFlash/security/advisories/new).
