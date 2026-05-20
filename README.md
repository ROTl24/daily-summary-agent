# Daily Summary Agent

Daily Summary Agent 是一个本地优先的 Windows 日报工作台。它可以读取指定 Git 仓库的当日提交和未提交变更，结合手动补充的沟通、会议、产品决策等上下文，通过 DeepSeek 生成可编辑的 Markdown 日报，并保存到本机目录。

## 功能

- 本地桌面工作台：React + Vite 前端，Electron 封装为 Windows 应用。
- Git 证据采集：汇总当天提交、待提交变更和仓库级错误信息。
- 手动上下文：补充非代码工作，避免日报只覆盖 Git 历史。
- DeepSeek 生成：使用配置的 DeepSeek API Key 生成结构化日报。
- Markdown 编辑与保存：生成后可继续编辑，并保存为 `YYYY-MM-DD-daily.md`。
- 本地配置：API Key、输出目录和仓库列表保存在用户本机应用数据目录。

## 快速开始

```powershell
pnpm install
pnpm dev
```

开发模式会同时启动本地服务和 Vite 页面。默认服务地址为 `http://127.0.0.1:8787`，前端开发地址为 `http://127.0.0.1:5173`。

## 桌面应用

本项目已经配置 Electron Builder，可以在 Windows 上打包出安装包和免安装可执行文件：

```powershell
pnpm package:win
```

打包完成后，产物会出现在 `release/` 目录中：

- `Daily Summary Agent Setup ... .exe`：Windows 安装包。
- `Daily Summary Agent ... .exe`：portable 免安装版本，双击即可运行。

`release/` 已被 `.gitignore` 忽略，构建产物不会默认提交到仓库。

## 配置说明

首次打开应用后，在左侧配置：

1. 填写 DeepSeek API Key。
2. 选择日报输出目录。
3. 添加一个或多个 Git 仓库路径。
4. 为每个仓库填写业务名称和关键词。
5. 保存配置后读取证据、生成日报并保存 Markdown 文件。

配置默认保存在 `%APPDATA%\DailySummaryAgent\config.json`。不要把真实 API Key 提交到仓库。

## 常用命令

```powershell
pnpm lint
pnpm test
pnpm build
pnpm electron
pnpm package:win
```

## 技术栈

- Node.js ESM
- React 19
- Vite
- Electron
- Electron Builder
- `node:test`

## 仓库状态

这是一个本地日报生成工具，重点是把 Git 证据、手动上下文和 AI 生成流程放在同一个可审阅的桌面工作台里。项目默认不提交本地配置、生成报告、构建目录和打包产物。
