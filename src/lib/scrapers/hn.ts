import { chromium } from 'playwright';
import { BaseScraper, ScrapedLink } from './base';

export interface HNConfig {
    keywords: string[];
    minPoints: number;
    maxResults: number;
}

export class HackerNewsScraper extends BaseScraper {
    platformName = 'Hacker News';

    async scrape(config: HNConfig): Promise<ScrapedLink[]> {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        let results: (ScrapedLink & { points: number })[] = [];

        try {
            await page.goto('https://news.ycombinator.com/');

            const stories = await page.$$('.athing');

            for (const story of stories) {
                const titleElement = await story.$('.titleline > a');
                const id = await story.getAttribute('id');
                const subtext = await page.$(`#score_${id}`);

                if (titleElement && subtext) {
                    const title = await titleElement.innerText();
                    const url = await titleElement.getAttribute('href') || '';
                    const scoreText = await subtext.innerText();
                    const points = parseInt(scoreText.replace(' points', '')) || 0;

                    // 1. 检查关键词
                    const matchesKeyword = config.keywords.some(k =>
                        title.toLowerCase().includes(k.toLowerCase())
                    );

                    // 2. 检查基本热度
                    if (matchesKeyword && points >= config.minPoints) {
                        results.push({
                            title,
                            url,
                            author: 'Hacker News',
                            publishedAt: new Date(),
                            source: 'Hacker News',
                            points
                        });
                    }
                }
            }

            // 3. 根据热度排序并取前 N 名
            results.sort((a, b) => b.points - a.points);
            results = results.slice(0, config.maxResults);

        } catch (error) {
            console.error('HN scrape error:', error);
        } finally {
            await browser.close();
        }

        // 移除内部 points 字段返回
        return results.map(({ points, ...rest }) => rest);
    }
}
