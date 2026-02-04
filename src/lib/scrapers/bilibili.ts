import { BaseScraper, ScrapedLink } from './base';
import crypto from 'crypto';

export interface BilibiliContent {
    title: string;
    description: string;
    transcript?: string;
    url: string;
    uploader?: string;       // UP 主名称
    uploaderId?: string;     // UP 主 ID
    uploaderAvatar?: string; // UP 主头像
    publishDate?: string;
    duration?: string;
    views?: number;
}

/**
 * B站内容抓取器
 * 使用纯 HTTP API + SESSDATA Cookie 获取字幕，无需 Playwright
 */
export class BilibiliScraper extends BaseScraper {
    platformName = 'Bilibili';

    /**
     * 从 URL 提取 BV 号
     */
    private extractBvid(url: string): string | null {
        const match = url.match(/video\/(BV[A-Za-z0-9]+)/);
        return match ? match[1] : null;
    }

    /**
     * 获取视频完整信息（标题、描述、AID、CID 等）
     */
    private async getVideoInfo(bvid: string, sessdata?: string): Promise<any | null> {
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.bilibili.com/'
        };
        if (sessdata) {
            headers['Cookie'] = `SESSDATA=${sessdata}`;
        }

        const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { headers });
        const data = await res.json();

        if (data.code !== 0) {
            console.error(`[Bilibili] Failed to get video info for ${bvid}:`, data.message);
            return null;
        }

        return data.data;
    }

    /**
     * 获取字幕列表
     */
    private async getSubtitleList(aid: number, cid: number, bvid: string, sessdata: string): Promise<any[]> {
        const res = await fetch(`https://api.bilibili.com/x/player/wbi/v2?cid=${cid}&aid=${aid}&bvid=${bvid}`, {
            headers: {
                'Cookie': `SESSDATA=${sessdata}`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': `https://www.bilibili.com/video/${bvid}/`
            }
        });
        const data = await res.json();

        if (data.code !== 0) {
            console.error(`[Bilibili] Failed to get subtitle info:`, data.message);
            return [];
        }

        return data.data?.subtitle?.subtitles || [];
    }

    /**
     * 下载字幕内容
     */
    private async downloadSubtitle(subtitleUrl: string): Promise<string> {
        const url = subtitleUrl.startsWith('//') ? `https:${subtitleUrl}` : subtitleUrl;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com/'
            }
        });
        const data = await res.json();
        return data.body.map((item: any) => item.content).join('\n');
    }

    /**
     * 获取视频内容（含字幕），使用 SESSDATA Cookie
     */
    async getVideoContent(url: string, sessdata?: string): Promise<BilibiliContent | null> {
        const bvid = this.extractBvid(url);
        if (!bvid) {
            console.error('[Bilibili] Invalid URL, cannot extract BVid:', url);
            return null;
        }

        console.log(`[Bilibili] Fetching video: ${bvid}`);

        // 1. 获取视频信息
        const videoData = await this.getVideoInfo(bvid, sessdata);
        if (!videoData) {
            return null;
        }

        const content: BilibiliContent = {
            title: videoData.title,
            description: videoData.desc || '',
            url,
            uploader: videoData.owner?.name,
            uploaderId: String(videoData.owner?.mid || ''),
            uploaderAvatar: videoData.owner?.face,
            publishDate: new Date(videoData.pubdate * 1000).toISOString().split('T')[0],
            duration: `${Math.floor(videoData.duration / 60)}分${videoData.duration % 60}秒`,
            views: videoData.stat?.view
        };

        // 2. 如果有 SESSDATA，尝试获取字幕
        if (sessdata) {
            console.log(`[Bilibili] Fetching subtitles for ${bvid}...`);
            const subtitles = await this.getSubtitleList(videoData.aid, videoData.cid, bvid, sessdata);

            if (subtitles.length > 0) {
                const targetSub = subtitles.find((s: any) => s.lan === 'zh-Hans') || subtitles[0];
                console.log(`[Bilibili] Found subtitle: ${targetSub.lan_doc}`);
                const transcript = await this.downloadSubtitle(targetSub.subtitle_url);
                content.transcript = transcript;
                console.log(`[Bilibili] Transcript length: ${transcript.length} chars`);
            } else {
                console.log(`[Bilibili] No subtitles available for ${bvid}`);
            }
        } else {
            console.log(`[Bilibili] No SESSDATA provided, skipping subtitle fetch`);
        }

        return content;
    }

    /**
     * 格式化为 NotebookLM 友好的文本
     */
    formatForNotebookLM(content: BilibiliContent): string {
        return `# ${content.title}

## 视频信息
- **UP主**: ${content.uploader || '未知'}
- **发布时间**: ${content.publishDate || '未知'}
- **视频链接**: ${content.url}
- **播放量**: ${content.views || '未知'}
- **时长**: ${content.duration || '未知'}

## 视频简介
${content.description || '无'}

## 字幕内容
${content.transcript || '无字幕'}
`;
    }

    /**
     * WBI 签名相关逻辑
     */
    private mixinKeyEncTab = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
        33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 54, 40,
        63, 65, 62, 21, 51, 55, 30, 61, 26, 64, 52, 22, 11, 25, 34, 17, 36, 1, 6,
        4, 44, 0, 60, 20, 59
    ];

    // WBI Keys 缓存（30 分钟有效期）
    private wbiKeysCache: { imgKey: string; subKey: string; expiry: number } | null = null;
    private readonly WBI_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

    private getMixinKey(ae: string) {
        let s = "";
        this.mixinKeyEncTab.forEach((item) => {
            s += ae[item];
        });
        return s.slice(0, 32);
    }

    private encWbi(params: Record<string, any>, imgKey: string, subKey: string) {
        const mixinKey = this.getMixinKey(imgKey + subKey);
        const currTime = Math.round(Date.now() / 1000);
        const chrFilter = /[!'()*]/g;
        const query: string[] = [];

        params.wts = currTime;

        Object.keys(params).sort().forEach((key) => {
            let val = params[key].toString();
            val = val.replace(chrFilter, '');
            query.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
        });

        const queryString = query.join('&');
        const wRid = crypto.createHash('md5').update(queryString + mixinKey).digest('hex');
        return queryString + '&w_rid=' + wRid;
    }

    private async getWbiKeys(): Promise<{ imgKey: string; subKey: string }> {
        // 检查缓存是否有效
        if (this.wbiKeysCache && Date.now() < this.wbiKeysCache.expiry) {
            console.log('[Bilibili] Using cached WBI keys');
            return { imgKey: this.wbiKeysCache.imgKey, subKey: this.wbiKeysCache.subKey };
        }

        console.log('[Bilibili] Fetching fresh WBI keys...');
        const res = await fetch('https://api.bilibili.com/x/web-interface/nav');
        const { data } = await res.json();
        const imgUrl = data.wbi_img.img_url;
        const subUrl = data.wbi_img.sub_url;
        const imgKey = imgUrl.split('/').pop().split('.')[0];
        const subKey = subUrl.split('/').pop().split('.')[0];

        // 更新缓存
        this.wbiKeysCache = {
            imgKey,
            subKey,
            expiry: Date.now() + this.WBI_CACHE_TTL
        };

        return { imgKey, subKey };
    }

    /**
     * 抓取最新视频列表 (100% HTTP via WBI)
     */
    async scrape(whitelist: string[], sessdata?: string): Promise<ScrapedLink[]> {
        console.log('[Bilibili] >>> SCRAPE START (100% HTTP via WBI)');
        const results: ScrapedLink[] = [];

        try {
            const { imgKey, subKey } = await this.getWbiKeys();
            console.log(`[Bilibili] Got WBI keys, scanning ${whitelist.length} spaces...`);

            // 限制并发或顺序执行以避免触发风控
            for (const mid of whitelist) {
                const cleanMid = mid.trim();
                console.log(`[Bilibili] Scanning Space: ${cleanMid}`);

                const params = {
                    mid: cleanMid,
                    ps: 5,  // 获取最近 10 条（增量更新，由 history 过滤已处理的）
                    pn: 1,
                    platform: 'web',
                    web_location: 1550101,
                    order: 'pubdate'
                };

                const signedQuery = this.encWbi(params, imgKey, subKey);
                const url = `https://api.bilibili.com/x/space/wbi/arc/search?${signedQuery}`;

                const fetchHeaders: Record<string, string> = {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': `https://space.bilibili.com/${cleanMid}/video`,
                };
                if (sessdata) {
                    fetchHeaders['Cookie'] = `SESSDATA=${sessdata}`;
                }

                const res = await fetch(url, { headers: fetchHeaders });
                const data = await res.json();

                if (data.code === 0) {
                    const vlist = data.data?.list?.vlist || [];
                    for (const video of vlist) {
                        // 过滤掉时长小于 10 分钟的视频
                        // length 格式通常为 "MM:SS" 或 "HH:MM:SS"
                        const durationStr = video.length;
                        let durationSeconds = 0;
                        if (durationStr) {
                            const parts = durationStr.split(':').map(Number);
                            if (parts.length === 2) {
                                durationSeconds = parts[0] * 60 + parts[1];
                            } else if (parts.length === 3) {
                                durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                            }
                        }

                        if (durationSeconds < 600) {
                            console.log(`[Bilibili] Skipping short video: ${video.title} (${durationStr})`);
                            continue;
                        }

                        const videoUrl = `https://www.bilibili.com/video/${video.bvid}/`;
                        results.push({
                            title: video.title,
                            url: videoUrl,
                            author: video.author || cleanMid,
                            authorId: String(video.mid || cleanMid),
                            publishedAt: new Date(video.created * 1000),
                            source: 'Bilibili'
                        });
                    }
                    if (vlist.length > 0) {
                        console.log(`[Bilibili] Found ${vlist.length} videos for ${cleanMid}`);
                    }
                } else {
                    console.warn(`[Bilibili] API returned code ${data.code} for ${cleanMid}: ${data.message}`);
                }

                // 稍微休息一下
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (e) {
            console.error('[Bilibili] WBI Scrape failed:', e);
        }

        console.log(`[Bilibili] <<< SCRAPE END. Found ${results.length} total.`);
        return results;
    }
}
