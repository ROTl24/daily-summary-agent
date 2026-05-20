# Daily Summary Agent

Daily Summary Agent 是一个 Windows 本地日报生成工具。它会读取你选择的 Git 仓库，整理当天的提交、未提交变更和手动补充内容，然后生成一份可编辑、可保存的 Markdown 日报。

## 下载

请到 [Releases](https://github.com/ROTl24/daily-summary-agent/releases/latest) 下载 Windows 版本：

- `Daily Summary Agent 0.1.0.exe`：免安装版，下载后双击运行。
- `Daily Summary Agent Setup 0.1.0.exe`：安装版，适合长期使用。

## 适合谁用

- 每天需要整理研发日报、项目进展或工作复盘的人。
- 希望把 Git 提交、未提交变更和手动补充内容放在一起审阅的人。
- 想先生成 Markdown，再手动调整措辞后保存的人。

## 使用方法

1. 打开应用。
2. 填写 DeepSeek API Key。
3. 选择日报保存目录。
4. 添加需要统计的 Git 仓库。
5. 为仓库填写项目名称和关键词。
6. 点击「读取证据」，检查当天工作内容。
7. 补充会议、沟通、排查、产品决策等非代码工作。
8. 点击「生成日报」，确认内容后保存。

## 注意事项

- API Key 只保存在本机，请不要提交到公开仓库。
- 日报生成前可以先检查证据，避免遗漏非代码工作。
- 未提交变更会作为待跟进内容展示，不会自动修改你的仓库文件。
- 如果当天日报文件已经存在，应用会提示你是否覆盖保存。

## 从源码运行

```powershell
pnpm install
pnpm dev
```

打包 Windows 应用：

```powershell
pnpm package:win
```
