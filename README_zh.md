# DailyReading
[English](./README.md)

这是一个集成了多源抓取与 AI 自动化同步的智能阅读助手。它能够自动从 YouTube、Bilibili 和 RSS 订阅源中筛选内容，并利用 Playwright 自动化技术将内容同步到 Google NotebookLM，为你分发并生成每日阅读总结。


## 🖥 核心组件：管理后台 (Dashboard)

本项目提供了一个完整的可视化管理后台，你无需手动编辑复杂的 JSON 配置文件或运行终端命令。

- **可视化配置**：在側边栏直接添加 YouTube 频道 ID、Bilibili UP 主 ID 以及 RSS 订阅链接。
- **页头控制中心**：
    - **🔐 会话授权**：授权按钮位于页头右侧，具有实时状态感知功能（琥珀色呼吸灯表示需授权，蓝色表示已授权）。
    - **▶ 任务控制**：点击 **"Start Routine"** 即可触发完整流程。内置**启动守卫**，若未授权将自动拦截并引导登录。
- **实时活动流 (Intelligence Feed)**：
    - 以卡片形式展示每日抓取到的内容。
    - 快速链接直接打开 NotebookLM 中生成的笔记本。

## 🛠 技术栈

- **框架**：[Next.js](https://nextjs.org/) (App Router)
- **自动化**：[Playwright](https://playwright.dev/) & [Playwright Extra](https://github.com/berstend/puppeteer-extra)
- **数据流**：基于 Server-Sent Events (SSE) 的实时任务进度反馈。

## 🚀 快速开始

### 1. 安装与启动

```bash
npm install
npx playwright install chromium
npm run dev
```
访问 [http://localhost:3000](http://localhost:3000) 进入管理后台。

### 2. 配置与同步

1. **设置 Chrome 路径**：
   - 在左侧边栏的 **"System Browser"** 区域，填入你电脑上 Google Chrome 的可执行文件全路径。
   - **Mac 示例**：`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
   - **Windows 示例**：`C:\Program Files\Google\Chrome\Application\chrome.exe`
2. **设置内容来源**：在侧边栏填入内容源，点击 **"Save Config"**。
3. **账号授权**：点击顶部的 **"🔐 NotebookLM Auth Required"**。在弹出的原生 Chrome 中完成登录并关闭即可。
4. **开始同步**：点击顶部的 **"Start Routine"**。

## 🖥 跨平台 (Windows) 建议

- **依赖安装**：Windows 用户同样需要运行 `npx playwright install chromium` 来支持基础爬虫。
- **路径格式**：在 UI 中配置路径时，Windows 用户请直接粘贴 `.exe` 文件的完整路径。
- **自动化运行**：macOS 用户可以使用项目自带的 `.plist` 配合 LaunchAgents。Windows 用户建议使用系统自带的 **"任务计划程序 (Task Scheduler)"**，创建一个定时触发后台命令的任务。

## 📂 项目结构

- `src/app/`: 管理后台界面与 API 路由（包括 `/api/status` 状态检测接口）。
- `src/lib/notebooklm.ts`: 核心的 NotebookLM 脚本同步逻辑。
- `src/lib/session_manager.ts`: 统一的本地会话管理工具。

---

*注意：本项目旨在提升个人效率，请遵守各平台的使用规范。*
