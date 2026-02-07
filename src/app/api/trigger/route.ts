
import { NextResponse } from 'next/server';
import { runDailyRoutine, isRunning } from '@/lib/main';

export const maxDuration = 300; // 设置超时时间为 300 秒 (5 分钟)，仅在 Vercel 生效，本地无所谓

export async function POST() {
    if (isRunning) {
        return NextResponse.json(
            {
                status: 'skipped',
                message: 'Routine is already running',
                scrapedItems: []
            },
            { status: 429 }
        );
    }

    console.log('[API-Trigger] Received trigger request. Starting routine (Sync mode)...');

    try {
        // 等待执行结果
        const result = await runDailyRoutine(
            (msg) => console.log(`[API-Log] ${msg}`),
            true // closeOnFinish
        );

        return NextResponse.json(result, { status: 200 });

    } catch (error) {
        console.error('[API-Trigger] Routine failed:', error);
        return NextResponse.json({
            status: 'failed',
            message: error instanceof Error ? error.message : String(error),
            scrapedItems: []
        }, { status: 500 });
    }
}
