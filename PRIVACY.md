# Privacy

LocalKeepFlash processes captures in the browser and writes them to a directory selected by the user.

It does not:

- create an account;
- send captures to KeepFlash;
- use analytics, advertising, crash reporting, or tracking pixels;
- call an AI service;
- load executable code from a remote server;
- synchronize extension settings through Chrome Sync.

When the user saves a page, LocalKeepFlash reads that page and may request image resources referenced by it. Those asset requests use `credentials: omit`. YouTube captures may request YouTube-owned player and caption endpoints to obtain the selected video's captions.

The extension stores the selected directory handle, interface language, caption language preferences, and an incomplete-save intent in browser-local storage. Saved content is not encrypted. If the chosen folder is synchronized by another application, that application's privacy policy applies.

Uninstalling LocalKeepFlash does not remove files from the selected directory.
