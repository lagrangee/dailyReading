import { YouTubeScraper } from './scrapers/youtube';
import { BilibiliScraper } from './scrapers/bilibili';
import { RSSScraper } from './scrapers/rss';
import { ScrapedLink } from './scrapers/base';
import { readHistory } from './history';
import { writeConfig } from './config';

// Source 项配置
export interface SourceItem {
    id: string;
    enabled: boolean;
    name?: string;    // 缓存的频道名称
    avatar?: string;  // 缓存的头像 URL
}

export interface AppConfig {
    platforms: {
        youtube?: { sources: SourceItem[] };
        bilibili?: { sources: SourceItem[] };
        [key: string]: any;
    };
    rss_feeds: string[];
    chrome_exe_path: string;
    bilibili_sessdata?: string;
}

export class ScrapeCoordinator {
    private youtube = new YouTubeScraper();
    private bilibili = new BilibiliScraper();
    private rss = new RSSScraper();

    async scrapeAll(config: AppConfig, onProgress?: (msg: string) => void): Promise<ScrapedLink[]> {
        const allResults: ScrapedLink[] = [];
        let configUpdated = false;

        // 1. 处理 YouTube（只抓取 enabled 的 sources）
        const youtubeConfig = config.platforms?.youtube;
        const youtubeIds = youtubeConfig?.sources?.filter(s => s.enabled).map(s => s.id) || [];
        if (youtubeIds.length > 0) {
            if (onProgress) onProgress(`Starting YouTube scrape...`);
            try {
                const links = await this.youtube.scrape(youtubeIds);
                allResults.push(...links);
                // 更新 YouTube sources 的名称信息
                if (this.updateSourceInfo(config, 'youtube', links)) {
                    configUpdated = true;
                }
            } catch (error) {
                console.error('YouTube scrape error:', error);
            }
        }

        // 2. 处理 Bilibili（只抓取 enabled 的 sources）
        const bilibiliConfig = config.platforms?.bilibili;
        const bilibiliIds = bilibiliConfig?.sources?.filter(s => s.enabled).map(s => s.id) || [];
        if (bilibiliIds.length > 0) {
            if (onProgress) onProgress(`Starting Bilibili scrape...`);
            try {
                const links = await this.bilibili.scrape(bilibiliIds, config.bilibili_sessdata);
                allResults.push(...links);
                // 更新 Bilibili sources 的名称信息
                if (this.updateSourceInfo(config, 'bilibili', links)) {
                    configUpdated = true;
                }
            } catch (error) {
                console.error('Bilibili scrape error:', error);
            }
        }

        // 3. 处理 RSS 类来源
        if (config.rss_feeds && config.rss_feeds.length > 0) {
            if (onProgress) onProgress('Starting RSS scrape...');
            try {
                const rssLinks = await this.rss.scrape(config.rss_feeds);
                allResults.push(...rssLinks);
            } catch (error) {
                console.error('RSS scrape error:', error);
            }
        }

        // 如果有更新，保存配置
        if (configUpdated) {
            console.log('[Coordinator] Config updated with source info');
            await writeConfig(config);
        }

        const history = await readHistory();
        return allResults.filter(link => !history.includes(link.url));
    }

    /**
     * 根据抓取结果更新配置中 source 的名称和头像信息
     * 返回是否有更新
     */
    private updateSourceInfo(config: AppConfig, platform: 'youtube' | 'bilibili', links: ScrapedLink[]): boolean {
        const sources = config.platforms?.[platform]?.sources;
        if (!sources || sources.length === 0) return false;

        let updated = false;
        for (const link of links) {
            // 通过 authorId 或 author 匹配 source
            const matchId = link.authorId || link.author;
            const source = sources.find(s =>
                s.id === matchId ||
                s.id === link.author ||
                (link.authorId && s.id === link.authorId)
            );

            if (source) {
                // 如果 name 为空或等于 id（意味着还没有真正更新），用 author 填充
                const needsNameUpdate = !source.name || source.name === source.id;
                if (needsNameUpdate && link.author && link.author !== source.id) {
                    source.name = link.author;
                    updated = true;
                    console.log(`[Coordinator] Updated ${platform} source ${source.id} name: ${link.author}`);
                }
                // 如果 avatar 为空且有 authorAvatar，填充
                if (!source.avatar && link.authorAvatar) {
                    source.avatar = link.authorAvatar;
                    updated = true;
                    console.log(`[Coordinator] Updated ${platform} source ${source.id} avatar`);
                }
            }
        }

        return updated;
    }
}

