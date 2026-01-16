import { chromium, BrowserContext, Page } from 'playwright';
import { ScrapedLink } from './scrapers/base';
import { readConfig } from './config';
import path from 'path';

import { getSessionDir, clearSessionLock } from './session_manager';

export class NotebookLMClient {
    private context: BrowserContext | null = null;

    async init() {
        console.log('[NotebookLM] >>> LAUNCH START');

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
                '--window-size=1280,800'
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
            const closeButton = page.getByRole('button', { name: '关闭对话框' });
            try { await closeButton.waitFor({ state: 'visible', timeout: 15000 }); } catch (e) { }

            if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await closeButton.click();
                await page.waitForTimeout(500);
            }

            await page.locator('input').click();
            await page.locator('input').fill(notebookName);
            await page.locator('input').press('Enter');
            await page.waitForTimeout(1000);
        }

        return page;
    }

    async getNotebookUrl(page: Page): Promise<string> {
        return page.url();
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
            try { await this.addYouTubeSource(page, link.url); } catch (e) { console.error('[YouTube] YT Error:', e); }
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
                await this.addTextSource(page, link.title, textContent);
                console.log(`[NotebookLM] ✅ SUCCESS: Bilibili content added.`);
            } else {
                console.warn(`[NotebookLM] ⏭️ SKIP: Link reached addSources without transcript: ${link.url}`);
            }
        }

        // 3. Web
        if (webLinks.length > 0) {
            console.log(`[NotebookLM] Batching ${webLinks.length} web links`);
            try { await this.addWebLinksBatch(page, webLinks.map(l => l.url)); } catch (e) { console.error('[NotebookLM] Web Error:', e); }
        }
    }

    private async addYouTubeSource(page: Page, url: string) {
        await page.getByRole('button', { name: '添加来源' }).click();
        await page.waitForTimeout(500);
        await page.getByText('YouTube', { exact: true }).click();
        await page.waitForTimeout(500);
        await page.getByRole('textbox', { name: '粘贴 YouTube 网址' }).fill(url);
        await page.getByRole('button', { name: '插入' }).click();
        await page.waitForTimeout(2000);
    }

    private async addWebLinksBatch(page: Page, urls: string[]) {
        await page.getByRole('button', { name: '添加来源' }).click();
        await page.waitForTimeout(500);
        await page.locator('span').filter({ hasText: '网站' }).nth(2).click();
        await page.waitForTimeout(500);
        await page.getByRole('textbox', { name: '粘贴网址' }).fill(urls.join('\n'));
        await page.getByRole('button', { name: '插入' }).click();
        await page.waitForTimeout(3000);
    }

    private async addTextSource(page: Page, title: string, content: string) {
        await page.getByRole('button', { name: '添加来源' }).click();
        await page.waitForTimeout(500);
        await page.getByText('复制的文字', { exact: true }).click();
        await page.waitForTimeout(500);
        await page.locator('textarea.text-area').fill(content);
        await page.getByRole('button', { name: '插入' }).click();
        await page.waitForTimeout(2000);
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
