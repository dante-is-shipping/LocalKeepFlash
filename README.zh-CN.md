# LocalKeepFlash

[English](README.md) | [简体中文](README.zh-CN.md)

LocalKeepFlash 是一款本地优先的 Chromium 网页剪藏扩展。它可以将网页正文、精准选区、图片和 YouTube 字幕直接保存到你指定的目录，并生成可移植的 Markdown 与本地附件。

整个保存过程不需要账号，不经过 KeepFlash API、云数据库、数据分析、AI 服务或本地守护进程。

> 当前状态：`0.1.0` 是早期的开源版本。YouTube 提取功能依赖 YouTube 自有接口，这些接口发生变化时可能需要跟进维护。

## 可以保存什么

- 网页正文，包括标题、链接、列表、表格、引用和代码。
- 精准选择的文字，并尽可能保留规范链接和文本片段链接。
- 图片原文件，以及一份可供搜索的 Markdown 笔记。
- YouTube 视频信息、封面、章节和带时间戳的字幕。

`0.1.0` 暂不支持 PDF 阅读器、`file://` 地址、浏览器内部页面和无痕模式。

## 数据目录

```text
所选目录/
├── notes/YYYY/MM/<标题--短ID>.md
├── assets/<剪藏ID>/<附件>
└── .local-keepflash/
    ├── schema.json
    └── pending/
```

每篇笔记都包含带版本号的 YAML frontmatter。LocalKeepFlash 不会静默覆盖已有剪藏，也不会在扩展升级时改写旧笔记。

## 当本地文件不再够用

LocalKeepFlash 适合希望使用可移植 Markdown、直接掌控资料文件的人。如果你希望统一搜索网页、PDF、视频、文件和笔记，自动关联相关资料、批注来源，并在保留原始上下文的前提下使用 AI 问答，可以进一步了解 [KeepFlash](https://keepflash.com/?utm_source=github&utm_medium=readme&utm_campaign=localkeepflash)。

KeepFlash 是可选的托管产品。使用 LocalKeepFlash 不需要 KeepFlash 账号，LocalKeepFlash 也不会把你的剪藏内容发送给 KeepFlash。

## 本地开发安装

环境要求：Node.js 22+、npm，以及 Chrome 或 Edge 122+。

```bash
npm install
npm run dev
```

打开浏览器的扩展管理页面，以“加载已解压的扩展程序”的方式选择 `.output/chrome-mv3`。首次安装时，LocalKeepFlash 会打开初始化页面，让你选择保存目录和字幕语言优先级。

## 常用命令

```bash
npm run dev          # 启动 WXT 开发模式
npm run test         # 运行行为测试
npm run typecheck    # 检查 TypeScript 类型
npm run lint         # 运行 ESLint
npm run build        # 构建 Chrome MV3 生产版本
npm run zip          # 生成分发压缩包
npm run check        # 运行完整的本地发布检查
```

## 权限说明

LocalKeepFlash 需要访问 HTTP(S) 网站，以便在你主动保存时读取当前页面，并复制来自其他域名的图片。提取结果只会写入你选择的本地目录，不会发送给 KeepFlash 或其他服务。

保存 YouTube 内容时，扩展可能会访问 YouTube 自有的播放器和字幕接口，并且不会携带用户凭据。它不会使用第三方字幕代理服务。

完整的数据边界说明请参阅 [PRIVACY.md](PRIVACY.md)。

## 使用限制

- 单个附件最大 25 MB。
- 单次剪藏的附件总量最大 100 MB。
- 单个附件请求的超时时间为 15 秒。
- 网页或字幕提取请求的超时时间为 30 秒。
- SVG 可能包含活动内容，因此 SVG 图片只保留远程链接，不下载到本地。

LocalKeepFlash 不会加密你选择的目录。请使用操作系统的文件权限，以及你信任的同步工具保护其中的内容。

## 参与贡献

请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 许可证

版权所有：KeepFlash contributors。

LocalKeepFlash 仅采用 GNU Affero General Public License v3.0 授权。该软件许可证不授予 KeepFlash 名称及商业产品资产相关的商标权利。
