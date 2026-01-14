import { chromium, BrowserContext, Page, Browser } from 'playwright';
import { ScrapedLink } from './scrapers/base';
import path from 'path';

export class NotebookLMClient {
    private context: BrowserContext | null = null;

    async init() {
        console.log('[NotebookLM] Launching persistent browser context...');

        // 使用持久化配置目录，而不是 JSON 文件
        const profilePath = path.join(process.cwd(), '.sessions', 'notebooklm_profile');

        this.context = await chromium.launchPersistentContext(profilePath, {
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            headless: false,
            viewport: null,
            // 彻底屏蔽所有 Playwright 默认附带的、具有“机器人”特征的参数
            ignoreDefaultArgs: [
                '--enable-automation',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--use-mock-keychain'
            ],
            args: [
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,800'
            ],
        });

        console.log(`[NotebookLM] Using persistent profile at: ${profilePath}`);
    }

    async createDailyNotebook(notebookName: string): Promise<Page> {
        if (!this.context) throw new Error('Client not initialized');
        const page = await this.context.newPage();

        // 暂时禁用路由拦截以排除问题
        // await page.route('**/*', (route) => {
        //     const resourceType = route.request().resourceType();
        //     if (['image', 'media', 'font'].includes(resourceType)) {
        //         route.abort();
        //     } else {
        //         route.continue();
        //     }
        // });

        console.log('[NotebookLM] Navigating to NotebookLM...');
        await page.goto('https://notebooklm.google.com/', { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(3000);

        // 检查是否被重定向到登录页
        const currentUrl = page.url();
        console.log('[NotebookLM] Page loaded:', currentUrl);

        if (currentUrl.includes('accounts.google.com')) {
            console.log('[NotebookLM] ⚠️ Session expired! Please run: ./update_notebooklm_session.sh');
            throw new Error('Session expired. Please update NotebookLM session.');
        }

        // 使用 codegen 生成的选择器：getByRole('button', { name: 包含笔记本名称 })
        console.log(`[NotebookLM] Looking for notebook: ${notebookName}`);

        // 尝试找到包含笔记本名称的按钮（名称后可能有 emoji）
        const notebookButton = page.getByRole('button', { name: new RegExp(notebookName) }).first();

        if (await notebookButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log(`[NotebookLM] Found notebook: ${notebookName}, opening...`);
            await notebookButton.click();
            await page.waitForTimeout(2000);
        } else {
            console.log(`[NotebookLM] Notebook ${notebookName} not found, creating new...`);

            // 点击"新建笔记本"
            await page.locator('mat-card').filter({ hasText: '新建笔记本' }).click();

            // 等待页面跳转并出现“关闭对话框”按钮（表示页面已加载且弹窗已出现）
            const closeButton = page.getByRole('button', { name: '关闭对话框' });
            try {
                await closeButton.waitFor({ state: 'visible', timeout: 15000 });
            } catch (e) {
                console.log('[NotebookLM] Close button didn\'t appear in time, checking URL...');
            }

            // 关闭默认弹出的"添加内容源"弹窗
            if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await closeButton.click();
                await page.waitForTimeout(500);
            }

            // 给笔记本改名
            console.log(`[NotebookLM] Renaming notebook to: ${notebookName}`);
            await page.locator('input').click();
            await page.locator('input').fill(notebookName);
            await page.locator('input').press('Enter');
            await page.waitForTimeout(1000);

            console.log(`[NotebookLM] Created notebook: ${notebookName}`);
        }

        return page;
    }

    async getNotebookUrl(page: Page): Promise<string> {
        return page.url();
    }

    async addSources(page: Page, links: ScrapedLink[], onProgress?: (msg: string) => void) {
        console.log(`[NotebookLM] Adding ${links.length} sources...`);

        // 分离 YouTube 链接和网站链接
        const youtubeLinks = links.filter(l => l.url.includes('youtube.com'));
        const webLinks = links.filter(l => !l.url.includes('youtube.com'));

        // 添加 YouTube 链接（需要逐个添加）
        for (let i = 0; i < youtubeLinks.length; i++) {
            const link = youtubeLinks[i];
            console.log(`[NotebookLM] [YouTube ${i + 1}/${youtubeLinks.length}] ${link.title}`);
            if (onProgress) onProgress(`Syncing YouTube (${i + 1}/${youtubeLinks.length}): ${link.title}`);

            try {
                await this.addYouTubeSource(page, link.url);
                console.log(`[NotebookLM] ✓ Added YouTube: ${link.url}`);
            } catch (e) {
                console.error(`[NotebookLM] ✗ Failed: ${link.url}`, e);
            }
        }

        // 批量添加网站链接（一次性添加所有）
        if (webLinks.length > 0) {
            console.log(`[NotebookLM] Adding ${webLinks.length} website links in batch...`);
            if (onProgress) onProgress(`Syncing ${webLinks.length} website links...`);

            try {
                await this.addWebLinksBatch(page, webLinks.map(l => l.url));
                console.log(`[NotebookLM] ✓ Added ${webLinks.length} website links`);
            } catch (e) {
                console.error(`[NotebookLM] ✗ Failed to add website links`, e);
            }
        }
    }

    private async addYouTubeSource(page: Page, url: string) {
        console.log(`[NotebookLM] Adding YouTube source: ${url}`);

        await page.getByRole('button', { name: '添加来源' }).click();
        await page.waitForTimeout(500);

        await page.getByText('YouTube', { exact: true }).click();
        await page.waitForTimeout(500);

        await page.getByRole('textbox', { name: '粘贴 YouTube 网址' }).click();
        await page.getByRole('textbox', { name: '粘贴 YouTube 网址' }).fill(url);
        await page.waitForTimeout(300);

        await page.getByRole('button', { name: '插入' }).click();
        await page.waitForTimeout(2000);
    }

    private async addWebLinksBatch(page: Page, urls: string[]) {
        // 将所有网站链接用换行符连接，一次性添加
        const batchUrls = urls.join('\n');
        console.log(`[NotebookLM] Adding ${urls.length} website links in one batch`);

        await page.getByRole('button', { name: '添加来源' }).click();
        await page.waitForTimeout(500);

        await page.locator('span').filter({ hasText: '网站' }).nth(2).click();
        await page.waitForTimeout(500);

        await page.getByRole('textbox', { name: '粘贴网址' }).click();
        await page.getByRole('textbox', { name: '粘贴网址' }).fill(batchUrls);
        await page.waitForTimeout(300);

        await page.getByRole('button', { name: '插入' }).click();
        await page.waitForTimeout(3000); // 批量添加可能需要更长时间
    }

    async askForSummary(page: Page) {
        console.log('[NotebookLM] Asking for summary...');
        try {
            await page.getByRole('textbox', { name: '查询框' }).click();
            await page.getByRole('textbox', { name: '查询框' }).fill('总结');
            await page.locator('query-box').getByRole('button', { name: '提交' }).click();
            console.log('[NotebookLM] Summary request submitted.');
            // 等待一段时间让总结生成
            await page.waitForTimeout(5000);
        } catch (e) {
            console.error('[NotebookLM] Failed to ask for summary:', e);
        }
    }

    async close() {
        console.log('[NotebookLM] Closing persistent context...');
        if (this.context) await this.context.close();
    }
}
