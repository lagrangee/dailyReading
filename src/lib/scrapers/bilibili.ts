import { chromium } from 'playwright';
import { BaseScraper, ScrapedLink } from './base';
import { getSessionDir } from '../session_manager';

export class BilibiliScraper extends BaseScraper {
    platformName = 'Bilibili';

    async scrape(whitelist: string[]): Promise<ScrapedLink[]> {
        const sessionDir = await getSessionDir('bilibili');

        const context = await chromium.launchPersistentContext(sessionDir, {
            headless: true,
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 },
            args: ['--disable-blink-features=AutomationControlled'],
            ignoreDefaultArgs: ['--enable-automation'],
        });
        const page = await context.newPage();

        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        const results: ScrapedLink[] = [];

        try {
            for (const mid of whitelist) {
                const cleanMid = mid.trim();
                console.log(`[Bilibili] Accessing Space: ${cleanMid}`);

                await page.waitForTimeout(Math.random() * 1500 + 500);

                try {
                    // 尝试访问视频投稿页
                    await page.goto(`https://space.bilibili.com/${cleanMid}/video`, {
                        waitUntil: 'domcontentloaded',
                        timeout: 20000
                    });

                    await this.handleLoginModal(page);

                    let items = await page.$$('.small-item, .list-list .item, .video-list .video-item');

                    // 如果没有视频，尝试动态页
                    if (items.length === 0) {
                        console.log(`[Bilibili] No videos found, trying /dynamic for ${cleanMid}...`);
                        await page.goto(`https://space.bilibili.com/${cleanMid}/dynamic`, {
                            waitUntil: 'domcontentloaded',
                            timeout: 20000
                        });
                        await this.handleLoginModal(page);
                        await page.waitForTimeout(2000);
                        items = await page.$$('.bili-dyn-list__item, .card');
                    }

                    if (items.length === 0) {
                        console.log(`[Bilibili] No content found for ${cleanMid}`);
                        continue;
                    }

                    // 取第一个内容
                    const item = items[0];
                    const titleEl = await item.$('.title, .bili-dyn-content__orig__title, a');
                    const linkEl = await item.$('a');

                    if (linkEl) {
                        let title = titleEl ? await titleEl.innerText() : 'Bilibili Content';
                        let url = await linkEl.getAttribute('href') || '';

                        if (url.startsWith('//')) url = `https:${url}`;
                        if (url.startsWith('/')) url = `https://www.bilibili.com${url}`;
                        url = url.split('?')[0];

                        results.push({
                            title: title.substring(0, 100).trim(),
                            url,
                            author: cleanMid,
                            publishedAt: new Date(),
                            source: 'Bilibili'
                        });
                    }
                } catch (e) {
                    console.log(`[Bilibili] Error scraping ${cleanMid}:`, e);
                    continue;
                }
            }
        } catch (error) {
            console.error('[Bilibili] Scrape error:', error);
        } finally {
            await context.close();
        }

        return results;
    }

    private async handleLoginModal(page: any) {
        try {
            await page.waitForTimeout(1500);
            const closeBtn = await page.$('.bili-mini-close-icon, .close-con');
            if (closeBtn) {
                console.log('[Bilibili] Closing login modal...');
                await closeBtn.click().catch(() => { });
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
            }
        } catch (e) { }
    }
}
