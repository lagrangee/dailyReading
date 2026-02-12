import { chromium, BrowserContext, Page } from 'playwright';
import { ScrapedLink } from './scrapers/base';
import { readConfig } from './config';
import { execSync } from 'child_process';
import path from 'path';

import { getSessionDir, clearSessionLock } from './session_manager';
import { slog } from './slog';

export class NotebookLMClient {
    private context: BrowserContext | null = null;

    private runAgent(args: string[]): string {
        const cmd = `agent-browser ${args.join(' ')} --cdp 9222`;
        console.log(`[NotebookLM] Agent Executing: ${cmd}`);
        try {
            return execSync(cmd, { encoding: 'utf-8' });
        } catch (error: any) {
            console.warn(`[NotebookLM] Agent Command failed: ${cmd}`, error.message);
            throw error;
        }
    }

    async init() {
        console.log('[NotebookLM] >>> LAUNCH START');

        // 彻底清理可能的旧进程和环境污染
        try {
            // 暂时清除环境干扰并关闭
            execSync('AGENT_BROWSER_EXECUTABLE_PATH= agent-browser close', { stdio: 'ignore' });
        } catch (e) { }

        await clearSessionLock('notebooklm');
        const profilePath = await getSessionDir('notebooklm');
        const config = await readConfig();

        this.context = await chromium.launchPersistentContext(profilePath, {
            executablePath: config.chrome_exe_path,
            headless: false,
            viewport: null,
            ignoreDefaultArgs: [
                '--enable-automation',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--use-mock-keychain'
            ],
            args: [
                '--disable-blink-features=AutomationControlled',
                '--password-store=basic',
                '--window-size=1280,800',
                '--remote-debugging-port=9222'
            ],
        });

        this.context.on('page', page => {
            page.on('close', async () => {
                setTimeout(async () => {
                    const pages = this.context?.pages();
                    if (pages && pages.length === 0) {
                        console.log('[NotebookLM] All pages closed. Cleaning up...');
                        await this.context?.close().catch(() => { });
                        this.context = null;
                    }
                }, 800);
            });
        });

        console.log(`[NotebookLM] Using profile: ${profilePath}`);
    }

    async createDailyNotebook(notebookName: string): Promise<Page> {
        if (!this.context) throw new Error('Client not initialized');

        const pages = this.context.pages();
        let page = pages.length > 0 ? pages[0] : await this.context.newPage();

        console.log('[NotebookLM] Navigating to Google...');
        await page.bringToFront();
        await page.goto('https://notebooklm.google.com/', { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(2000);

        const currentUrl = page.url();
        console.log('[NotebookLM] Page Loaded URL:', currentUrl);

        if (currentUrl.includes('accounts.google.com')) {
            throw new Error('NotebookLM Session Required. Please login first.');
        }

        console.log(`[NotebookLM] Resolving Notebook: ${notebookName}`);
        const notebookButton = page.getByRole('button', { name: new RegExp(notebookName) }).first();

        if (await notebookButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log(`[NotebookLM] Opening: ${notebookName}`);
            await notebookButton.click();
            await page.waitForTimeout(2000);
        } else {
            console.log(`[NotebookLM] Creating: ${notebookName}`);
            await page.locator('mat-card').filter({ hasText: '新建笔记本' }).click();
            await page.waitForTimeout(2000);

            // 新界面：关闭自动弹出的资料上传建议窗口
            const closeButton = page.getByRole('button', { name: '关闭' });
            try {
                await closeButton.waitFor({ state: 'visible', timeout: 5000 });
                await closeButton.click();
                await page.waitForTimeout(500);
                console.log('[NotebookLM] Closed initial popup');
            } catch (e) {
                console.log('[NotebookLM] No popup to close');
            }

            // 修改笔记本名称
            const titleInput = page.locator('input.title-input');
            await titleInput.click();
            await titleInput.fill('');
            await titleInput.fill(notebookName);
            await titleInput.press('Enter');
            await page.waitForTimeout(1000);
        }

        return page;
    }

    async getNotebookUrl(page: Page): Promise<string> {
        return page.url();
    }

    // 截断作者/频道名称，最大 5 个字符
    private truncateName(name: string, maxLength: number = 5): string {
        return name.length > maxLength ? name.slice(0, maxLength) : name;
    }

    async addSources(page: Page, links: ScrapedLink[], onProgress?: (msg: string) => void) {
        console.log(`[NotebookLM] addSources with ${links.length} links`);

        const youtubeLinks = links.filter(l => l.url.includes('youtube.com'));
        const bilibiliLinks = links.filter(l => l.url.includes('bilibili.com'));
        const webLinks = links.filter(l => !l.url.includes('youtube.com') && !l.url.includes('bilibili.com'));

        // 1. YouTube
        for (let i = 0; i < youtubeLinks.length; i++) {
            const link = youtubeLinks[i];
            console.log(`[NotebookLM] [YouTube ${i + 1}/${youtubeLinks.length}] ${link.title}`);
            if (onProgress) onProgress(`YouTube (${i + 1}/${youtubeLinks.length})`);
            try {
                await this.addYouTubeSource(page, link);
                slog('YouTube', 'success', { author: link.author, title: link.title, detail: 'Source added & renamed' });
            } catch (e: any) {
                slog('YouTube', 'fail', { author: link.author, title: link.title, detail: e.message });
            }
        }

        // 2. Bilibili (直接使用 pre-extracted 文本)
        for (let i = 0; i < bilibiliLinks.length; i++) {
            const link = bilibiliLinks[i];
            console.log(`[NotebookLM] [Bilibili ${i + 1}/${bilibiliLinks.length}] ${link.title}`);
            if (onProgress) onProgress(`Bilibili (${i + 1}/${bilibiliLinks.length})`);

            // 优先使用格式化后的完整内容（包含视频元数据）
            const textContent = link.formattedContent ||
                (link.transcript ? `# ${link.title}\n\n## 视频简介\n${link.description || ''}\n\n## 字幕内容\n${link.transcript}` : null);

            if (textContent) {
                // B站来源标题格式：UP主名称(截断)-视频标题
                const sourceTitle = `${this.truncateName(link.author)}-${link.title}`;
                await this.addTextSource(page, sourceTitle, textContent);
                slog('Bilibili', 'success', { author: link.author, title: link.title, detail: 'Source added & renamed' });
            } else {
                slog('Bilibili', 'skip', { author: link.author, title: link.title, detail: 'No transcript, skipped' });
            }
        }

        // 3. Web
        if (webLinks.length > 0) {
            console.log(`[NotebookLM] Batching ${webLinks.length} web links`);
            try {
                await this.addWebLinksBatch(page, webLinks.map(l => l.url));
                slog('Web', 'success', { title: `${webLinks.length} web links added` });
            } catch (e: any) {
                slog('Web', 'fail', { title: 'Batch web links', detail: e.message });
            }
        }
    }

    private async addYouTubeSource(page: Page, link: ScrapedLink) {
        await page.getByRole('button', { name: '添加来源' }).click();
        await page.waitForTimeout(500);
        // 新界面：YouTube 已合并到"网站"按钮
        await page.getByRole('button', { name: '网站' }).click();
        await page.waitForTimeout(500);
        await page.getByRole('textbox', { name: '输入网址' }).fill(link.url);
        await page.getByRole('button', { name: '插入' }).click();

        // YouTube 来源标题格式：YouTuber名称(截断)-视频标题
        const sourceTitle = `${this.truncateName(link.author)}-${link.title}`;
        console.log(`[NotebookLM] Renaming YouTube source to "${sourceTitle}"...`);

        // 等待来源加载完成并重命名 — 用视频原始标题精确匹配
        await this.renameSourceByText(page, link.title, sourceTitle);
    }

    /**
     * 等待来源列表稳定（加载完成、排序完成）。
     * 通过检测容器数量连续 3 秒不再变化来判断稳定。
     */
    private async waitForSourceListStable(page: Page, timeoutSeconds: number = 60): Promise<number> {
        let lastCount = -1;
        let stableCount = 0;

        for (let attempt = 0; attempt < timeoutSeconds; attempt++) {
            await page.waitForTimeout(1000);
            const currentCount = await page.locator('.single-source-container').count();

            if (currentCount === lastCount && currentCount > 0) {
                stableCount++;
                if (stableCount >= 3) {
                    console.log(`[NotebookLM] Source list stable: ${currentCount} sources (took ${attempt + 1}s)`);
                    return currentCount;
                }
            } else {
                stableCount = 0;
            }
            lastCount = currentCount;

            if (attempt % 10 === 9) {
                console.log(`[NotebookLM] Waiting for source list to stabilize... (${attempt + 1}s, count=${currentCount})`);
            }
        }

        console.warn(`[NotebookLM] Source list did not stabilize within ${timeoutSeconds}s, proceeding with count=${lastCount}`);
        return lastCount;
    }

    /**
     * 通过来源名称精确定位并重命名来源。
     * @param matchText 用于匹配的文本（YouTube: 视频原标题, Bilibili: "粘贴的文字"）
     * @param newTitle 新的来源名称
     */
    private async renameSourceByText(page: Page, matchText: string, newTitle: string) {
        try {
            // 1. 等待来源列表稳定
            await this.waitForSourceListStable(page);

            // 2. 按文本精确匹配来源容器
            const targetContainer = page.locator('.single-source-container').filter({ hasText: matchText }).first();
            const moreButton = targetContainer.locator('button[aria-label="更多"]');

            // 等待目标容器的"更多"按钮可见
            let found = false;
            for (let attempt = 0; attempt < 15; attempt++) {
                if (await moreButton.isVisible().catch(() => false)) {
                    found = true;
                    console.log(`[NotebookLM] Found source matching "${matchText.substring(0, 30)}..."`);
                    break;
                }
                await page.waitForTimeout(1000);
            }

            if (!found) {
                throw new Error(`Could not find source matching "${matchText.substring(0, 50)}" after 15 seconds`);
            }

            // 3. 点击"更多"按钮
            await moreButton.click();
            console.log('[NotebookLM] Clicked "More" button');
            await page.waitForTimeout(500);

            // 4. 点击"重命名来源"
            const renameMenuItem = page.getByText('重命名来源');
            await renameMenuItem.waitFor({ state: 'visible', timeout: 5000 });
            await renameMenuItem.click();
            console.log('[NotebookLM] Clicked "Rename source"');
            await page.waitForTimeout(500);

            // 5. 输入新名称
            const renameInput = page.getByRole('textbox', { name: '来源名称' });
            await renameInput.waitFor({ state: 'visible', timeout: 5000 });
            await renameInput.fill('');
            await renameInput.fill(newTitle);
            console.log(`[NotebookLM] Entered new name: "${newTitle}"`);

            // 6. 点击"保存"
            await page.getByRole('button', { name: '保存' }).click();
            await page.waitForTimeout(500);

            console.log(`[NotebookLM] ✅ SUCCESS: Renamed to "${newTitle}"`);
        } catch (e: any) {
            console.error(`[NotebookLM] ❌ FAILED rename for "${newTitle}":`, e.message);
        }
    }

    private async addWebLinksBatch(page: Page, urls: string[]) {
        await page.getByRole('button', { name: '添加来源' }).click();
        await page.waitForTimeout(500);
        // 新界面：使用按钮角色定位"网站"
        await page.getByRole('button', { name: '网站' }).click();
        await page.waitForTimeout(500);
        await page.getByRole('textbox', { name: '输入网址' }).fill(urls.join('\n'));
        await page.getByRole('button', { name: '插入' }).click();
        await page.waitForTimeout(3000);
    }

    private async addTextSource(page: Page, title: string, content: string) {
        await page.getByRole('button', { name: '添加来源' }).click();
        await page.waitForTimeout(500);
        // 新界面：使用按钮角色定位"复制的文字"
        await page.getByRole('button', { name: '复制的文字' }).click();
        await page.waitForTimeout(500);

        // 使用 evaluate 填充内容，避免 Playwright 在日志中输出完整字幕
        const textbox = page.getByRole('textbox', { name: '粘贴的文字' });
        await textbox.waitFor({ state: 'visible', timeout: 5000 });
        console.log(`[NotebookLM] Filling text content (${content.length} chars)...`);
        await textbox.evaluate((el: HTMLTextAreaElement, text: string) => {
            el.value = text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, content);
        await page.waitForTimeout(300);

        await page.getByRole('button', { name: '插入' }).click();

        // 等待插入完成并重命名 — 用"粘贴的文字"精确匹配
        console.log(`[NotebookLM] Renaming source to "${title}"...`);
        await this.renameSourceByText(page, '粘贴的文字', title);
    }

    async askForSummary(page: Page) {
        console.log('[NotebookLM] Requesting Summary...');
        try {
            const queryBox = page.getByRole('textbox', { name: '查询框' });
            await queryBox.waitFor({ state: 'visible', timeout: 30000 });
            let isReady = false;
            for (let i = 0; i < 30; i++) {
                if (!(await queryBox.isDisabled())) { isReady = true; break; }
                await page.waitForTimeout(2000);
            }
            if (!isReady) throw new Error('Query box remained disabled.');
            await queryBox.fill('总结');
            await page.locator('query-box').getByRole('button', { name: '提交' }).click();
        } catch (e) { throw e; }
    }

    async close() {
        if (this.context) await this.context.close();
    }
}
