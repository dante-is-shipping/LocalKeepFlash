# Chrome Web Store listing

This document is the canonical source for the LocalKeepFlash Chrome Web Store submission. Keep the dashboard, extension behavior, and `PRIVACY.md` consistent.

## Product details

- Name: `LocalKeepFlash`
- Primary category: `Productivity`
- Default language: `English`
- Visibility: `Public`
- In-app purchases: `No`
- Homepage: `https://github.com/dante-is-shipping/LocalKeepFlash`
- Support: `https://github.com/dante-is-shipping/LocalKeepFlash/issues`
- Privacy policy: `https://github.com/dante-is-shipping/LocalKeepFlash/blob/main/PRIVACY.md`

## English listing

### Summary

Save pages, selections, images, and YouTube transcripts directly to local Markdown.

### Detailed description

LocalKeepFlash is a local-first web clipper that saves the web into a folder you choose as readable Markdown and local assets.

Use the toolbar button, keyboard shortcut, or right-click menu to save:

- readable articles with headings, links, lists, tables, quotes, and code;
- exact text selections with source links;
- original raster images with searchable Markdown notes;
- YouTube metadata, chapters, and timestamped captions.

Your archive can be a normal folder, an Obsidian vault, or a directory synchronized by software you already trust. LocalKeepFlash does not require an account and does not send captures to KeepFlash, an AI service, analytics, or a cloud database.

Saved files remain portable and readable without the extension. LocalKeepFlash never silently overwrites an earlier capture.

Current limitations: PDF viewers, `file://` pages, browser-internal pages, SVG downloads, and Incognito mode are not supported.

## Simplified Chinese listing

### Summary

将网页、选区、图片与 YouTube 字幕直接保存为本地 Markdown。

### Detailed description

LocalKeepFlash 是一款本地优先的网页剪藏扩展，可将网页保存为可读的 Markdown 和本地资源，并直接写入你选择的目录。

你可以通过工具栏按钮、快捷键或右键菜单保存：

- 保留标题、链接、列表、表格、引用和代码的文章正文；
- 带来源链接的精确文本选区；
- 原始位图文件及可搜索的 Markdown 说明；
- YouTube 视频信息、章节和带时间戳的字幕。

资料库可以是普通目录、Obsidian 仓库，或由你信任的软件负责同步的目录。LocalKeepFlash 不需要账号，也不会把剪藏内容发送到 KeepFlash、AI 服务、数据分析平台或云数据库。

保存后的文件无需扩展也能直接阅读。LocalKeepFlash 不会静默覆盖已有剪藏。

当前限制：暂不支持 PDF 阅读器、`file://` 页面、浏览器内部页面、SVG 下载和无痕模式。

## Single purpose

Save content explicitly selected by the user from the current website into a user-selected local folder as portable Markdown and local assets.

## Permission justifications

### `activeTab`

Used after the user clicks the toolbar button or invokes the save shortcut to identify and act on the current page. The extension does not capture pages in the background without a user action.

### `contextMenus`

Adds Save page, Save selection, and Save image actions to the browser's right-click menu.

### `scripting`

Injects the packaged extraction script into the current tab if it is not already available when the user requests a save. No remotely hosted code is executed.

### `storage`

Stores the selected directory handle, interface and caption language preferences, and a short-lived pending save intent in browser-local storage. Chrome Sync is not used.

### Host permissions: `http://*/*` and `https://*/*`

LocalKeepFlash is a general-purpose web clipper. Broad HTTP(S) access is required to extract the user-requested page and retrieve its referenced images or YouTube-owned caption resources. Processing begins only after an explicit toolbar, shortcut, or context-menu action. Captured content is written locally and is not sent to the developer, KeepFlash, analytics, advertising, AI, or another cloud service.

## Remote code

No. All executable code is included in the extension package. The extension does not use `eval`, remote scripts, WebAssembly loaded from a remote server, or external code execution.

## Data disclosure

Data types handled locally:

- Web history: the URL of the page the user explicitly asks to save.
- Website content: page text, selected text, image URLs, metadata, and YouTube captions needed for the requested capture.

Data handling declarations:

- The developer does not collect or receive this data.
- Data is processed locally for the extension's single purpose.
- Data is not sold or transferred to third parties.
- Data is not used for advertising, profiling, creditworthiness, or unrelated purposes.
- Humans do not read the data.

## Graphic assets

- Store icon: 128x128 PNG in the extension ZIP.
- Screenshots: 1280x800 PNG or JPEG, 1 required and up to 5 allowed.
- Small promo tile: 440x280 PNG or JPEG, required.
- Marquee promo tile: 1400x560 PNG or JPEG, optional.

Recommended screenshot sequence:

1. Save a readable webpage with the toolbar button and show the success toast.
2. Show the resulting Markdown note and downloaded assets in an Obsidian vault or file editor.
3. Save an exact text selection from the right-click menu.
4. Show a YouTube transcript note with chapters and timestamped captions.
5. Show the LocalKeepFlash settings page with folder and transcript-language controls.
