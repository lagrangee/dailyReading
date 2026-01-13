import { YouTubeScraper } from './scrapers/youtube';
import { BilibiliScraper } from './scrapers/bilibili';
import { RSSScraper } from './scrapers/rss';
import { HackerNewsScraper } from './scrapers/hn';
import { ScrapedLink } from './scrapers/base';
import { readHistory } from './history';

export interface AppConfig {
    youtube_whitelist: string[];
    bilibili_whitelist: string[];
    rss_feeds: string[];
    hn_config: {
        keywords: string[];
        minPoints: number;
        maxResults: number;
    };
}

export class ScrapeCoordinator {
    private youtube = new YouTubeScraper();
    private bilibili = new BilibiliScraper();
    private rss = new RSSScraper();
    private hn = new HackerNewsScraper();

    async scrapeAll(config: AppConfig, onProgress?: (msg: string) => void): Promise<ScrapedLink[]> {
        if (onProgress) onProgress('Starting YouTube scrape...');
        const youtubeLinks = await this.youtube.scrape(config.youtube_whitelist);

        if (onProgress) onProgress('Starting Bilibili scrape...');
        const bilibiliLinks = await this.bilibili.scrape(config.bilibili_whitelist);

        if (onProgress) onProgress('Starting RSS scrape...');
        const rssLinks = await this.rss.scrape(config.rss_feeds);

        if (onProgress) onProgress('Starting HN scrape...');
        const hnLinks = await this.hn.scrape(config.hn_config);

        const flatResults = [
            ...youtubeLinks,
            ...bilibiliLinks,
            ...rssLinks,
            ...hnLinks
        ];

        const history = await readHistory();
        return flatResults.filter(link => !history.includes(link.url));
    }
}
