import { ScrapeCoordinator } from './coordinator';
import { NotebookLMClient } from './notebooklm';
import { readConfig } from './config';
import { addLog, updateLogById } from './logger';
import { addToHistory } from './history';
import path from 'path';
import { randomUUID } from 'crypto';

export async function runDailyRoutine(onProgress?: (msg: string) => void) {
    const config = await readConfig();
    const coordinator = new ScrapeCoordinator();
    const logId = randomUUID();

    if (onProgress) onProgress('Initializing scrapers...');
    const links = await coordinator.scrapeAll(config, onProgress);

    if (onProgress) onProgress(`Found ${links.length} new items.`);

    if (links.length === 0) {
        if (onProgress) onProgress('No new content. Finishing.');
        await addLog({
            id: logId,
            timestamp: new Date().toLocaleString(),
            status: 'none',
            message: 'No new content to sync.',
            linksScraped: 0,
            notebookSyncStatus: 'pending'
        });
        return;
    }

    // 先记录抓取结果，NotebookLM 同步状态为 pending
    await addLog({
        id: logId,
        timestamp: new Date().toLocaleString(),
        status: 'success',
        message: `Scraped ${links.length} items. NotebookLM sync pending...`,
        linksScraped: links.length,
        notebookSyncStatus: 'pending',
        details: links.map(l => ({
            title: l.title,
            url: l.url,
            source: l.source
        }))
    });

    // 记录到历史
    await addToHistory(links.map(l => l.url));

    const client = new NotebookLMClient();

    try {
        if (onProgress) onProgress('Launching browser for NotebookLM...');
        await client.init(); // 使用默认的 storage state
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');
        const notebookName = `daily_${dateStr}`;

        if (onProgress) onProgress(`Creating notebook: ${notebookName}`);
        const page = await client.createDailyNotebook(notebookName);
        const notebookUrl = await client.getNotebookUrl(page);

        await client.addSources(page, links, onProgress);

        // 更新日志：同步成功
        await updateLogById(logId, {
            message: `Successfully synced ${links.length} items to NotebookLM.`,
            notebookUrl: notebookUrl,
            notebookSyncStatus: 'success'
        });

        if (onProgress) onProgress('Task completed successfully!');
    } catch (error) {
        console.error('NotebookLM sync failed:', error);

        // 更新日志：同步失败
        await updateLogById(logId, {
            notebookSyncStatus: 'failed',
            notebookSyncError: error instanceof Error ? error.message : String(error)
        });

        if (onProgress) onProgress(`NotebookLM sync failed: ${error}`);
    } finally {
        await client.close();
    }
}
