import { ScrapeCoordinator } from './coordinator';
import { NotebookLMClient } from './notebooklm';
import { BilibiliScraper } from './scrapers/bilibili';
import { readConfig } from './config';
import { addLog, updateLogById } from './logger';
import { addToHistory } from './history';
import { randomUUID } from 'crypto';

export async function runDailyRoutine(onProgress?: (msg: string) => void) {
    console.log('[Main] >>> DAILY ROUTINE START');
    const config = await readConfig();
    const coordinator = new ScrapeCoordinator();
    const logId = randomUUID();

    let links: any[] = [];
    try {
        if (onProgress) onProgress('Initializing scrapers...');
        links = await coordinator.scrapeAll(config, onProgress);
        console.log(`[Main] Scraped ${links.length} items total.`);
    } catch (e) {
        console.error('[Main] Scrape phase failed:', e);
        if (onProgress) onProgress(`Scrape failed: ${e}`);
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
        console.log('[Main] No links found. Exiting.');
        return;
    }

    // --- 前置提取 Bilibili 字幕（使用 HTTP API + Cookie） ---
    const bilibiliLinks = links.filter(l => l.source === 'Bilibili');
    if (bilibiliLinks.length > 0) {
        if (onProgress) onProgress(`Extracting transcripts for ${bilibiliLinks.length} Bilibili videos...`);
        const bilibiliScraper = new BilibiliScraper();
        const sessdata = config.bilibili_sessdata;

        if (!sessdata) {
            console.warn('[Main] ⚠️ No bilibili_sessdata configured, skipping subtitle extraction');
            if (onProgress) onProgress('Warning: No Bilibili SESSDATA configured');
        } else {
            let configUpdated = false;
            for (const link of bilibiliLinks) {
                console.log(`[Main] Pre-extracting: ${link.url}`);
                try {
                    const content = await bilibiliScraper.getVideoContent(link.url, sessdata);
                    if (content && content.transcript && content.transcript.trim().length > 0) {
                        // 使用格式化后的文本（包含元数据）
                        link.formattedContent = bilibiliScraper.formatForNotebookLM(content);
                        link.transcript = content.transcript;
                        link.description = content.description;
                        console.log(`[Main] ✅ Success: Extracted transcript for ${link.title}`);
                    } else {
                        console.warn(`[Main] ⏭️ No transcript found for: ${link.title}`);
                    }

                    // 更新配置中的 source 信息（名称和头像）
                    if (content?.uploaderId && content?.uploader) {
                        const sources = config.platforms?.bilibili?.sources || [];
                        const source = sources.find(s => s.id === content.uploaderId || s.id === link.authorId);
                        console.log(`[Main] Debug: uploaderId=${content.uploaderId}, avatar=${content.uploaderAvatar}, source=${source?.id}`);
                        if (source) {
                            if (!source.name && content.uploader) {
                                source.name = content.uploader;
                                configUpdated = true;
                                console.log(`[Main] Updated source ${source.id} name: ${content.uploader}`);
                            }
                            if (!source.avatar && content.uploaderAvatar) {
                                source.avatar = content.uploaderAvatar;
                                configUpdated = true;
                                console.log(`[Main] Updated source ${source.id} avatar: ${content.uploaderAvatar}`);
                            }
                        }
                    }
                } catch (e) {
                    console.error(`[Main] Failed to extract ${link.url}:`, e);
                }
            }

            // 如果有更新，保存配置
            if (configUpdated) {
                const { writeConfig } = await import('./config');
                await writeConfig(config);
                console.log('[Main] Config updated with source info');
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
        console.log('[Main] No valid content found after filtering.');
        return;
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

    const client = new NotebookLMClient();

    try {
        if (onProgress) onProgress('Launching NotebookLM Context...');
        await client.init();

        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');
        const notebookName = `daily_${dateStr}`;

        const page = await client.createDailyNotebook(notebookName);
        const notebookUrl = await client.getNotebookUrl(page);

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
    } catch (error) {
        console.error('[Main] Sync error:', error);
        await updateLogById(logId, {
            notebookSyncStatus: 'failed',
            notebookSyncError: error instanceof Error ? error.message : String(error)
        });
        if (onProgress) onProgress(`Sync failed: ${error}`);
    } finally {
        console.log('[Main] Routine finished. Browser stays open.');
    }
}
