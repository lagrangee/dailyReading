import { NextRequest, NextResponse } from 'next/server';
import { NotebookLMClient } from '@/lib/notebooklm';
import { readLogs, updateLogById } from '@/lib/logger';
import path from 'path';

export async function POST(req: NextRequest) {
    const { logId } = await req.json();

    if (!logId) {
        return NextResponse.json({ error: 'Missing logId' }, { status: 400 });
    }

    const logs = await readLogs();
    const log = logs.find(l => l.id === logId);

    if (!log) {
        return NextResponse.json({ error: 'Log not found' }, { status: 404 });
    }

    if (!log.details || log.details.length === 0) {
        return NextResponse.json({ error: 'No links to sync' }, { status: 400 });
    }

    const client = new NotebookLMClient();

    try {
        await client.init(); // 使用默认的 storage state
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');
        const notebookName = `daily_${dateStr}`;

        console.log(`[Sync API] Creating/opening notebook: ${notebookName}`);
        const page = await client.createDailyNotebook(notebookName);
        const notebookUrl = await client.getNotebookUrl(page);
        console.log(`[Sync API] Notebook URL: ${notebookUrl}`);

        const links = log.details.map(d => ({
            title: d.title,
            url: d.url,
            author: '',
            publishedAt: new Date(),
            source: d.source
        }));

        console.log(`[Sync API] Adding ${links.length} sources...`);
        await client.addSources(page, links);
        console.log(`[Sync API] Sources added successfully`);

        await updateLogById(logId, {
            notebookUrl: notebookUrl,
            notebookSyncStatus: 'success',
            notebookSyncError: undefined
        });

        // 不要立即关闭浏览器，让用户可以检查结果
        // 浏览器会保持打开状态，用户手动关闭
        console.log(`[Sync API] Sync completed. Browser will stay open for review.`);

        // 等待用户关闭浏览器（可选，如果需要等待）
        // await new Promise<void>((resolve) => {
        //   client.context?.on('close', () => resolve());
        // });

        return NextResponse.json({ success: true, notebookUrl, message: 'Sync completed. Browser is open for review.' });
    } catch (error) {
        console.error(`[Sync API] Error:`, error);

        await updateLogById(logId, {
            notebookSyncStatus: 'failed',
            notebookSyncError: error instanceof Error ? error.message : String(error)
        });

        // 出错时也不要关闭浏览器，方便调试
        return NextResponse.json({
            error: `Sync failed: ${error}`
        }, { status: 500 });
    }
    // 注意：移除了 finally 中的 client.close()
    // 浏览器会保持打开，用户手动关闭
}
