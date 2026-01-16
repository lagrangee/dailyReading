# DailyReading
[English](./README.md)

这是一个集成了多源抓取与 AI 自动化同步的智能阅读助手。它能够自动从 YouTube、Bilibili 和 RSS 订阅源中筛选内容，提取字幕/转写文本，并同步到 Google NotebookLM 生成每日阅读总结。

![Dashboard 截图](./screenshot.png)

## ✨ 功能特性

- **多源内容抓取**
  - YouTube 频道（通过 RSS 订阅）
  - Bilibili UP主（通过 WBI API）
  - RSS 订阅源

- **字幕/转写提取**
  - Bilibili：通过 HTTP API + SESSDATA 认证自动提取中文字幕
  - YouTube：原生转写支持

- **智能来源管理**
  - 可视化仪表板，显示频道头像和名称
  - 开关按钮可启用/禁用各个来源
  - 自动缓存频道信息（名称、头像）

- **NotebookLM 集成**
  - 通过 Playwright 自动化同步
  - 直接链接到生成的笔记本

## 🛠 技术栈

- **框架**：[Next.js](https://nextjs.org/)（App Router）
- **抓取**：YouTube 和 Bilibili 100% 纯 HTTP（无需浏览器）
- **自动化**：[Playwright](https://playwright.dev/) 仅用于 NotebookLM 同步
- **实时更新**：基于 Server-Sent Events (SSE) 的任务进度反馈

## 🚀 快速开始

### 1. 安装

```bash
npm install
npx playwright install chromium
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 打开仪表板。

### 2. 配置

1. **添加来源**：在仪表板中添加 YouTube handle（`@channel`）和 Bilibili UID
2. **Bilibili SESSDATA**：在设置中添加你的 SESSDATA 以提取字幕（B站功能必需）
3. **Chrome 路径**：设置 Chrome 可执行文件路径用于 NotebookLM 同步
4. **NotebookLM 授权**：点击 NotebookLM 按钮进行授权

### 3. 运行同步

点击 **"Start Routine"** 会依次执行：
1. 从所有启用的来源抓取最新视频
2. 提取 Bilibili 字幕（如已配置 SESSDATA）
3. 同步内容到 NotebookLM

## � 项目结构

```
src/
├── app/              # 仪表板 UI 和 API 路由
├── lib/
│   ├── scrapers/     # 平台爬虫（YouTube、Bilibili、RSS）
│   ├── coordinator.ts # 抓取协调器
│   ├── main.ts       # 每日任务逻辑
│   └── notebooklm.ts # NotebookLM 自动化
```

## 🔧 Bilibili 字幕提取原理

1. 使用 WBI API 获取视频列表（无需浏览器）
2. 通过 SESSDATA Cookie 认证获取字幕权限
3. 下载并格式化中文字幕
4. 将格式化内容同步到 NotebookLM

## 🖥 跨平台说明

- **macOS**：使用 `deploy/` 目录中的 `.plist` 配合 LaunchAgents 定时运行
- **Windows**：使用任务计划程序自动运行
- **Chrome 路径示例**：
  - Mac：`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
  - Windows：`C:\Program Files\Google\Chrome\Application\chrome.exe`

---

*注意：本项目旨在提升个人效率，请遵守各平台的使用规范。*
