import { YouTubeScraper } from './scrapers/youtube';
import { BilibiliScraper } from './scrapers/bilibili';
import { RSSScraper } from './scrapers/rss';
import { BaseScraper, ScrapedLink } from './scrapers/base';
import { readHistory } from './history';

export interface AppConfig {
    platforms: {
        youtube?: { whitelist: string[] };
        bilibili?: { whitelist: string[] };
        [key: string]: any;
    };
    rss_feeds: string[];
    chrome_exe_path: string;
}

export class ScrapeCoordinator {
    private youtube = new YouTubeScraper();
    private bilibili = new BilibiliScraper();
    private rss = new RSSScraper();

    async scrapeAll(config: AppConfig, onProgress?: (msg: string) => void): Promise<ScrapedLink[]> {
        const allResults: ScrapedLink[] = [];

        // 1. 处理平台类来源
        const platformMap: Record<string, BaseScraper> = {
            youtube: this.youtube,
            bilibili: this.bilibili
        };

        for (const [platformId, scraper] of Object.entries(platformMap)) {
            const platformConfig = config.platforms?.[platformId];
            if (platformConfig && platformConfig.whitelist && platformConfig.whitelist.length > 0) {
                if (onProgress) onProgress(`Starting ${scraper.platformName} scrape...`);
                try {
                    const links = await scraper.scrape(platformConfig.whitelist);
                    allResults.push(...links);
                } catch (error) {
                    console.error(`${scraper.platformName} scrape error:`, error);
                }
            }
        }

        // 2. 处理 RSS 类来源
        if (config.rss_feeds && config.rss_feeds.length > 0) {
            if (onProgress) onProgress('Starting RSS scrape...');
            try {
                const rssLinks = await this.rss.scrape(config.rss_feeds);
                allResults.push(...rssLinks);
            } catch (error) {
                console.error('RSS scrape error:', error);
            }
        }

        const history = await readHistory();
        return allResults.filter(link => !history.includes(link.url));
    }
}
