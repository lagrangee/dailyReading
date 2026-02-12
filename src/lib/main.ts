import { ScrapeCoordinator } from './coordinator';
import { NotebookLMClient } from './notebooklm';
import { BilibiliScraper } from './scrapers/bilibili';
import { readConfig } from './config';
import { addLog, updateLogById } from './logger';
import { slog, slogPhase } from './slog';
import { addToHistory } from './history';
import { randomUUID } from 'crypto';

export interface RoutineResult {
    status: 'success' | 'failed' | 'no_content' | 'skipped';
    message: string;
    scrapedItems: { title: string; url: string; source: string }[];
    notebookUrl?: string;
    error?: string;
}

export let isRunning = false;

export async function runDailyRoutine(onProgress?: (msg: string) => void, closeOnFinish: boolean = false): Promise<RoutineResult> {
    if (isRunning) {
        console.warn('[Main] Routine is already running. Skipping.');
        if (onProgress) onProgress('Routine is already running.');
        return {
            status: 'skipped',
            message: 'Routine is already running',
            scrapedItems: []
        };
    }
    isRunning = true;
    let client: NotebookLMClient | null = null;

    slogPhase('DAILY ROUTINE START');
    try {
        const config = await readConfig();
        const coordinator = new ScrapeCoordinator();
        const logId = randomUUID();

        let links: any[] = [];
        try {
            if (onProgress) onProgress('Initializing scrapers...');
            links = await coordinator.scrapeAll(config, onProgress);
            slog('Main', 'info', { title: `Scraped ${links.length} items total` });
        } catch (e) {
            slog('Main', 'fail', { title: 'Scrape phase failed', detail: String(e) });
            if (onProgress) onProgress(`Scrape failed: ${e}`);
            throw e; // Re-throw to be caught by outer try-catch
        }

        if (links.length === 0) {
            if (onProgress) onProgress('No new content. Finishing.');
            await addLog({
                id: logId,
                timestamp: new Date().toLocaleString(),
                status: 'none',
                message: 'No new content found.',
                linksScraped: 0,
                notebookSyncStatus: 'pending'
            });
            slog('Main', 'info', { title: 'No new content found' });
            return {
                status: 'no_content',
                message: 'No new content found',
                scrapedItems: []
            };
        }

        // --- 前置提取 Bilibili 字幕（使用 HTTP API + Cookie） ---
        const bilibiliLinks = links.filter(l => l.source === 'Bilibili');
        if (bilibiliLinks.length > 0) {
            slogPhase(`Bilibili Transcript Extraction (${bilibiliLinks.length} videos)`);
            if (onProgress) onProgress(`Extracting transcripts for ${bilibiliLinks.length} Bilibili videos...`);
            const bilibiliScraper = new BilibiliScraper();
            const sessdata = config.bilibili_sessdata;

            if (!sessdata) {
                slog('Bilibili', 'warn', { title: 'No SESSDATA configured, skipping subtitle extraction' });
                if (onProgress) onProgress('Warning: No Bilibili SESSDATA configured');
            } else {
                let configUpdated = false;
                for (const link of bilibiliLinks) {
                    slog('Bilibili', 'info', { author: link.author, title: link.title, detail: 'Extracting transcript...' });
                    try {
                        const content = await bilibiliScraper.getVideoContent(link.url, sessdata);
                        if (content && content.transcript && content.transcript.trim().length > 0) {
                            // 使用格式化后的文本（包含元数据）
                            link.formattedContent = bilibiliScraper.formatForNotebookLM(content);
                            link.transcript = content.transcript;
                            link.description = content.description;
                            slog('Bilibili', 'success', { author: link.author, title: link.title, detail: `Transcript: ${content.transcript!.length} chars` });
                        } else {
                            slog('Bilibili', 'skip', { author: link.author, title: link.title, detail: 'No transcript' });
                        }

                        // 更新配置中的 source 信息（名称和头像）
                        if (content?.uploaderId && content?.uploader) {
                            const sources = config.platforms?.bilibili?.sources || [];
                            const source = sources.find(s => s.id === content.uploaderId || s.id === link.authorId);
                            if (source) {
                                if (!source.name && content.uploader) {
                                    source.name = content.uploader;
                                    configUpdated = true;
                                }
                                if (!source.avatar && content.uploaderAvatar) {
                                    source.avatar = content.uploaderAvatar;
                                    configUpdated = true;
                                }
                            }
                        }
                    } catch (e) {
                        slog('Bilibili', 'fail', { author: link.author, title: link.title, detail: String(e) });
                    }
                }

                // 如果有更新，保存配置
                if (configUpdated) {
                    const { writeConfig } = await import('./config');
                    await writeConfig(config);
                    slog('Main', 'info', { title: 'Config updated with source info' });
                }
            }
        }

        // 过滤掉没有字幕的 Bilibili 链接
        const filteredLinks = links.filter(l => {
            if (l.source === 'Bilibili') {
                return l.transcript && l.transcript.length > 0;
            }
            return true;
        });

        if (filteredLinks.length === 0) {
            if (onProgress) onProgress('No valid content after extraction. Finishing.');
            await addLog({
                id: logId,
                timestamp: new Date().toLocaleString(),
                status: 'none',
                message: 'No transcript-available content found to sync.',
                linksScraped: links.length,
                notebookSyncStatus: 'pending'
            });
            slog('Main', 'info', { title: 'No valid content after filtering' });
            return {
                status: 'no_content',
                message: 'No transcript-available content found',
                scrapedItems: links.map(l => ({ title: l.title, url: l.url, source: l.source }))
            };
        }

        // 更新日志：记录抓取和提取摘要
        await addLog({
            id: logId,
            timestamp: new Date().toLocaleString(),
            status: 'success',
            message: `Scraped ${links.length} items (${filteredLinks.length} valid). Syncing...`,
            linksScraped: links.length,
            notebookSyncStatus: 'pending',
            details: filteredLinks.map(l => ({
                title: l.title,
                url: l.url,
                source: l.source
            }))
        });

        await addToHistory(filteredLinks.map(l => l.url));

        client = new NotebookLMClient();
        let notebookUrl = '';

        try {
            slogPhase('NotebookLM Sync');
            if (onProgress) onProgress('Launching NotebookLM Context...');
            await client.init();

            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');
            const notebookName = `daily_${dateStr}`;

            const page = await client.createDailyNotebook(notebookName);
            notebookUrl = await client.getNotebookUrl(page);

            await client.addSources(page, filteredLinks, onProgress);

            if (onProgress) onProgress('Waiting for processing...');
            await page.waitForTimeout(5000);

            if (onProgress) onProgress('Asking for summary...');
            await client.askForSummary(page);

            await updateLogById(logId, {
                message: `Successfully synced ${filteredLinks.length} items.`,
                notebookUrl: notebookUrl,
                notebookSyncStatus: 'success'
            });

            if (onProgress) onProgress('Routine completed!');

            return {
                status: 'success',
                message: `Successfully synced ${filteredLinks.length} items`,
                scrapedItems: filteredLinks.map(l => ({ title: l.title, url: l.url, source: l.source })),
                notebookUrl
            };

        } catch (error) {
            slog('NotebookLM', 'fail', { title: 'Sync error', detail: String(error) });
            await updateLogById(logId, {
                notebookSyncStatus: 'failed',
                notebookSyncError: error instanceof Error ? error.message : String(error)
            });
            if (onProgress) onProgress(`Sync failed: ${error}`);
            throw error;
        }
    } catch (e: any) {
        slog('Main', 'fail', { title: 'Fatal error', detail: e.message || String(e) });
        return {
            status: 'failed',
            message: e.message || String(e),
            scrapedItems: [],
            error: e.message || String(e)
        };
    } finally {
        isRunning = false;
        if (closeOnFinish && client) {
            slog('Main', 'info', { title: 'Closing NotebookLM client (auto-close)' });
            await client.close();
        } else {
            slogPhase('DAILY ROUTINE COMPLETE');
        }
    }
}
