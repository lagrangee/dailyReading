# DailyReading
[简体中文](./README_zh.md)

A smart reading assistant that integrates multi-source scraping and AI automated synchronization. It automatically filters content from YouTube, Bilibili, and RSS feeds, and utilizes Playwright automation to sync content to Google NotebookLM, distributing and generating daily reading summaries for you.

## 🖥 Core Component: Dashboard

This project provides a full-featured visual dashboard, eliminating the need to manually edit complex JSON configuration files or run terminal commands.

- **Visual Configuration**: Directly add YouTube Channel IDs, Bilibili UP IDs, and RSS feed links in the sidebar.
- **Header Control Center**:
    - **🔐 Session Authorization**: The authorization button is located on the right side of the header with real-time status awareness (amber breathing light indicates authorization required, blue indicates authorized).
    - **▶ Task Control**: Click **"Start Routine"** to trigger the full process. Built-in **Pre-flight Guard** will automatically intercept and guide you to log in if not authorized.
- **Intelligence Feed**:
    - Displays daily scraped content in card format.
    - Quick links to directly open notebooks generated in NotebookLM.

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Automation**: [Playwright](https://playwright.dev/) & [Playwright Extra](https://github.com/berstend/puppeteer-extra)
- **Data Flow**: Real-time task progress feedback based on Server-Sent Events (SSE).

## 🚀 Quick Start

### 1. Installation and Execution

```bash
npm install
npx playwright install chromium
npm run dev # Launch dashboard
npm run run-sync # Run sync task only (CLI mode)
```
Access [http://localhost:3000](http://localhost:3000) to enter the dashboard.

### 2. Configuration and Sync

1. **Set Chrome Path**:
   - In the **"System Browser"** section of the sidebar, enter the full path of the Google Chrome executable on your computer.
   - **Mac Example**: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
   - **Windows Example**: `C:\Program Files\Google\Chrome\Application\chrome.exe`
2. **Set Content Sources**: Fill in the content sources in the sidebar and click **"Save Config"**.
3. **Session Authorization**: Click **"🔐 NotebookLM Auth Required"** in the header. Complete login in the pop-up native Chrome and close it.
4. **Start Routine**: Click **"▶ Start Routine"** in the header. If not authorized, the system will automatically guide you to log in.

## 🖥 Cross-platform (Windows) Suggestions

- **Dependency Installation**: Windows users also need to run `npx playwright install chromium` for basic scrapers.
- **Path Format**: When configuring the path in the UI, Windows users should directly paste the full path of the `.exe` file.
- **Automated Execution**: macOS users can use the `.plist` file in the `deploy/` directory with LaunchAgents. Windows users are recommended to use the **"Task Scheduler"**, creating a task to trigger the background command periodically.

## 📂 Project Structure

- `src/app/`: Dashboard frontend code and API routes (including the `/api/status` detection interface).
- `src/lib/notebooklm.ts`: Core NotebookLM automation sync logic.
- `src/lib/session_manager.ts`: Unified local session management tool.

---

*Note: This project is intended to improve personal efficiency. Please comply with the terms of use of each platform.*
