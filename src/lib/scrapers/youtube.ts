import { chromium } from 'playwright';
import { BaseScraper, ScrapedLink } from './base';
import { getSessionDir } from '../session_manager';
import Parser from 'rss-parser';
import fs from 'fs/promises';
import path from 'path';

const parser = new Parser();
const CACHE_FILE = path.join(process.cwd(), '.sessions', 'youtube_channels.json');

export class YouTubeScraper extends BaseScraper {
    platformName = 'YouTube';

    private async loadCache(): Promise<Record<string, string>> {
        try {
            const data = await fs.readFile(CACHE_FILE, 'utf-8');
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    private async saveCache(cache: Record<string, string>) {
        try {
            await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
            await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
        } catch (e) {
            console.error('[YouTube] Failed to save cache:', e);
        }
    }

    async scrape(whitelist: string[]): Promise<ScrapedLink[]> {
        const cache = await this.loadCache();
        const results: ScrapedLink[] = [];
        let browserContext: any = null;

        for (const name of whitelist) {
            const cleanName = name.trim();
            const handle = cleanName.startsWith('@') ? cleanName : `@${cleanName}`;

            let channelId = cache[handle];

            // 如果没有缓存，通过 Playwright 抓取 Channel ID
            if (!channelId) {
                console.log(`[YouTube] Searching for Channel ID for ${handle}`);
                let browser: any = null;

                try {
                    console.log(`[YouTube] Launching browser for ${handle}`);
                    browser = await chromium.launch({
                        headless: true, // 仍然保持无头以防环境不支持有头，但增加更多规避手段
                        args: [
                            '--disable-blink-features=AutomationControlled',
                            '--disable-features=IsolateOrigins,site-per-process',
                        ],
                    });

                    const context = await browser.newContext({
                        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                    });

                    // 预设 Cookie 尝试规避 Consent 页面
                    await context.addCookies([{
                        name: 'CONSENT',
                        value: 'YES+cb.20240117-07-p0.de+FX+999',
                        domain: '.youtube.com',
                        path: '/'
                    }]);

                    const page = await context.newPage();
                    // 隐藏 webdriver
                    await page.addInitScript(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    });

                    const response = await page.goto(`https://www.youtube.com/${handle}`, {
                        waitUntil: 'domcontentloaded',
                        timeout: 60000
                    });

                    // 处理可能出现的 Consent 页面
                    if (page.url().includes('consent.youtube.com')) {
                        console.log(`[YouTube] Consent page detected, attempting to accept...`);
                        // 寻找 "Alle akzeptieren" 按钮 (德语环境常见) 或 "Accept all" 
                        const acceptBtn = page.locator('button:has-text("Alle akzeptieren"), button:has-text("Accept all"), button:has-text("I agree")').first();
                        if (await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                            await acceptBtn.click();
                            console.log(`[YouTube] Consent accepted, waiting for navigation...`);
                            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
                        } else {
                            console.log(`[YouTube] Consent button not found, trying to submit form...`);
                            await page.locator('form[action*="consent.youtube.com"] button').last().click().catch(() => { });
                            await page.waitForTimeout(3000);
                        }
                    }

                    // Add a small buffer for critical meta tags to load
                    await page.waitForTimeout(2000);

                    // 1. 显式等待 meta 标签出现
                    channelId = await page.locator('meta[itemprop="identifier"]').getAttribute('content', { timeout: 10000 }).catch(() => null);

                    if (!channelId) {
                        console.log(`[YouTube] Itemprop identifier not found, checking channelId meta...`);
                        channelId = await page.locator('meta[itemprop="channelId"]').getAttribute('content', { timeout: 2000 }).catch(() => null);
                    }

                    // 2. 如果页面渲染有问题，尝试直接从初始 HTML 字符串中匹配
                    if (!channelId) {
                        const html = await page.content();
                        const metaMatch = html.match(/<meta[^>]*itemprop="identifier"[^>]*content="(UC[^"]*)"/) ||
                            html.match(/<meta[^>]*content="(UC[^"]*)"[^>]*itemprop="identifier"/) ||
                            html.match(/"(?:externalId|browseId)":"(UC[a-zA-Z0-9_-]+)"/);
                        if (metaMatch) {
                            channelId = metaMatch[1];
                        }
                    }

                    if (channelId) {
                        console.log(`[YouTube] Success! Found Channel ID for ${handle}: ${channelId}`);
                        cache[handle] = channelId;
                        await this.saveCache(cache);
                    } else {
                        console.error(`[YouTube] Could not find Channel ID for ${handle} via any method`);
                    }
                } catch (e) {
                    console.error(`[YouTube] Browser task failed for ${handle}:`, e);
                } finally {
                    if (browser) {
                        await browser.close().catch(() => { });
                    }
                }
            }

            // 如果有 Channel ID，通过 RSS 获取内容
            if (channelId) {
                try {
                    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
                    const feed = await parser.parseURL(rssUrl);

                    if (feed.items && feed.items.length > 0) {
                        const latest = feed.items[0];
                        results.push({
                            title: latest.title || 'Unknown Title',
                            url: latest.link || '',
                            author: cleanName,
                            publishedAt: latest.pubDate ? new Date(latest.pubDate) : new Date(),
                            source: 'YouTube'
                        });
                        console.log(`[YouTube] Got latest video via RSS for ${cleanName}: ${latest.title}`);
                    }
                } catch (e) {
                    console.error(`[YouTube] RSS fetch failed for ${cleanName}:`, e);
                }
            }
        }

        if (browserContext) {
            await browserContext.close();
        }

        return results;
    }
}
