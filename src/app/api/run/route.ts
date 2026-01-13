import { NextRequest } from 'next/server';
import { runDailyRoutine } from '@/lib/main';

export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendProgress = (msg: string) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: msg })}\n\n`));
            };

            try {
                sendProgress('Starting session...');
                // 运行主流程
                await runDailyRoutine(sendProgress);
                sendProgress('DONE');
            } catch (e) {
                sendProgress(`FATAL ERROR: ${e}`);
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
