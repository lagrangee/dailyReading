import Parser from 'rss-parser';
import { BaseScraper, ScrapedLink } from './base';

export class RSSScraper extends BaseScraper {
    platformName = 'RSS';
    private parser = new Parser();

    async scrape(urls: string[]): Promise<ScrapedLink[]> {
        const results: ScrapedLink[] = [];

        for (const url of urls) {
            try {
                const feed = await this.parser.parseURL(url);

                let foundIn24h = false;
                for (const item of feed.items) {
                    const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

                    if (this.isWithinLast24Hours(publishedAt)) {
                        results.push({
                            title: item.title || 'No Title',
                            url: item.link || '',
                            author: feed.title || 'Unknown Author',
                            publishedAt: publishedAt,
                            source: 'RSS'
                        });
                        foundIn24h = true;
                    }
                }

                // 兜底：抓取最新一条
                if (!foundIn24h && feed.items.length > 0) {
                    const item = feed.items[0];
                    results.push({
                        title: item.title || 'No Title (Latest)',
                        url: item.link || '',
                        author: feed.title || 'Unknown Author',
                        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                        source: 'RSS'
                    });
                }
            } catch (error) {
                console.error(`RSS scrape error for ${url}:`, error);
            }
        }

        return results;
    }
}
