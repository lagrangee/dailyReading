import { BaseScraper, ScrapedLink } from './base';
import Parser from 'rss-parser';
import fs from 'fs/promises';
import path from 'path';

const parser = new Parser();
const CACHE_FILE = path.join(process.cwd(), '.sessions', 'youtube_channels.json');

// 缓存格式：{ channelId, avatar? }
interface ChannelCache {
    channelId: string;
    avatar?: string;
}

export class YouTubeScraper extends BaseScraper {
    platformName = 'YouTube';

    private async loadCache(): Promise<Record<string, ChannelCache | string>> {
        try {
            const data = await fs.readFile(CACHE_FILE, 'utf-8');
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    private async saveCache(cache: Record<string, ChannelCache | string>) {
        try {
            await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
            await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
        } catch (e) {
            console.error('[YouTube] Failed to save cache:', e);
        }
    }

    // 兼容旧格式和新格式
    private getChannelInfo(cacheEntry: ChannelCache | string): ChannelCache {
        if (typeof cacheEntry === 'string') {
            return { channelId: cacheEntry };
        }
        return cacheEntry;
    }

    /**
     * 通过 HTTP 获取 Channel ID 和头像（无需 Playwright）
     */
    private async fetchChannelInfo(handle: string): Promise<ChannelCache | null> {
        try {
            console.log(`[YouTube] Fetching channel info for ${handle} via HTTP...`);
            const res = await fetch(`https://www.youtube.com/${handle}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en',
                    'Cookie': 'CONSENT=YES+'
                }
            });

            if (!res.ok) {
                console.error(`[YouTube] HTTP error: ${res.status}`);
                return null;
            }

            const html = await res.text();

            // 提取 Channel ID
            const channelIdMatch = html.match(/"channelId":"(UC[^"]+)"/) ||
                html.match(/"externalId":"(UC[^"]+)"/);
            if (!channelIdMatch) {
                console.error(`[YouTube] Could not find Channel ID for ${handle}`);
                return null;
            }
            const channelId = channelIdMatch[1];

            // 提取头像 URL
            const avatarMatch = html.match(/https:\/\/yt3\.googleusercontent\.com\/[^"]+/);
            const avatar = avatarMatch ? avatarMatch[0] : undefined;

            console.log(`[YouTube] Success! Found Channel ID: ${channelId}${avatar ? ' + avatar' : ''}`);
            return { channelId, avatar };
        } catch (e) {
            console.error(`[YouTube] Failed to fetch channel info for ${handle}:`, e);
            return null;
        }
    }

    async scrape(whitelist: string[]): Promise<ScrapedLink[]> {
        const cache = await this.loadCache();
        const results: ScrapedLink[] = [];
        let cacheUpdated = false;

        for (const name of whitelist) {
            const cleanName = name.trim();
            const handle = cleanName.startsWith('@') ? cleanName : `@${cleanName}`;

            let channelInfo = cache[handle] ? this.getChannelInfo(cache[handle]) : null;

            // 如果没有缓存，通过 HTTP 获取 Channel ID 和头像
            if (!channelInfo?.channelId) {
                channelInfo = await this.fetchChannelInfo(handle);
                if (channelInfo) {
                    cache[handle] = channelInfo;
                    cacheUpdated = true;
                }
            }

            // 保存更新的缓存
            if (cacheUpdated) {
                await this.saveCache(cache);
                cacheUpdated = false; // 重置，避免重复保存
            }

            // 如果有 Channel ID，通过 RSS 获取内容
            if (channelInfo?.channelId) {
                try {
                    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelInfo.channelId}`;
                    const feed = await parser.parseURL(rssUrl);

                    if (feed.items && feed.items.length > 0) {
                        const latest = feed.items[0];
                        const channelName = feed.title || cleanName;
                        results.push({
                            title: latest.title || 'Unknown Title',
                            url: latest.link || '',
                            author: channelName,
                            authorId: handle,
                            authorAvatar: channelInfo.avatar,
                            publishedAt: latest.pubDate ? new Date(latest.pubDate) : new Date(),
                            source: 'YouTube'
                        });
                        console.log(`[YouTube] Got latest video for ${cleanName} (${channelName}): ${latest.title}`);
                    }
                } catch (e) {
                    console.error(`[YouTube] RSS fetch failed for ${cleanName}:`, e);
                }
            }
        }

        return results;
    }
}

