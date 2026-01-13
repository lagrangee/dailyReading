import { chromium } from 'playwright';
import { BaseScraper, ScrapedLink } from './base';
import { getSessionDir } from '../session_manager';

export class YouTubeScraper extends BaseScraper {
    platformName = 'YouTube';

    async scrape(whitelist: string[]): Promise<ScrapedLink[]> {
        const sessionDir = await getSessionDir('youtube');

        const context = await chromium.launchPersistentContext(sessionDir, {
            headless: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            args: ['--disable-blink-features=AutomationControlled'],
            ignoreDefaultArgs: ['--enable-automation'],
        });
        const page = await context.newPage();

        // 隐藏 webdriver 属性
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        const results: ScrapedLink[] = [];

        try {
            for (const name of whitelist) {
                const cleanName = name.trim();
                console.log(`[YouTube] Scraping: ${cleanName}`);

                const handle = cleanName.startsWith('@') ? cleanName : `@${cleanName}`;

                try {
                    // 第一次尝试：直接访问频道视频页
                    await page.goto(`https://www.youtube.com/${handle}/videos`, {
                        waitUntil: 'domcontentloaded',
                        timeout: 15000
                    });

                    // 等待视频标题出现
                    await page.waitForSelector('#video-title', { timeout: 8000 });
                } catch (e) {
                    console.log(`[YouTube] Direct access failed for ${cleanName}, trying search...`);

                    try {
                        // 第二次尝试：搜索
                        await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanName)}`, {
                            waitUntil: 'domcontentloaded',
                            timeout: 15000
                        });
                        await page.waitForSelector('#video-title', { timeout: 8000 });
                    } catch (e2) {
                        console.log(`[YouTube] Search also failed for ${cleanName}, skipping.`);
                        continue;
                    }
                }

                const videos = await page.$$('#video-title-link, #video-title');
                if (videos.length > 0) {
                    const first = videos[0];
                    const title = await first.innerText();
                    let link = await first.getAttribute('href') || '';
                    if (link.startsWith('/')) link = `https://www.youtube.com${link}`;

                    results.push({
                        title: title.trim(),
                        url: link,
                        author: cleanName,
                        publishedAt: new Date(),
                        source: 'YouTube'
                    });
                }
            }
        } catch (error) {
            console.error('[YouTube] Scrape error:', error);
        } finally {
            await context.close();
        }

        return results;
    }
}
