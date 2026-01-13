import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { getSessionDir } from '@/lib/session_manager';

export async function POST(req: NextRequest) {
    const { platform } = await req.json();

    if (!['bilibili', 'youtube', 'notebooklm'].includes(platform)) {
        return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    // 所有平台都使用项目内的独立会话目录
    const sessionDir = await getSessionDir(platform as 'bilibili' | 'youtube' | 'notebooklm');

    try {
        // 使用独立配置文件目录，不会与用户正在使用的 Chrome 冲突
        const context = await chromium.launchPersistentContext(sessionDir, {
            headless: false,
            // 不指定 channel，使用 Playwright 自带的 Chromium
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 },
            // 这些参数可以帮助模拟真实浏览器
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
            ],
            ignoreDefaultArgs: ['--enable-automation'],
        });

        const page = await context.newPage();

        // 隐藏 webdriver 属性
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        if (platform === 'bilibili') {
            await page.goto('https://www.bilibili.com/');
        } else if (platform === 'youtube') {
            await page.goto('https://www.youtube.com/');
        } else {
            await page.goto('https://notebooklm.google.com/');
        }

        // 等待用户关闭浏览器窗口
        await new Promise<void>((resolve) => {
            context.on('close', () => resolve());
        });

        return NextResponse.json({ success: true, message: `${platform} session saved.` });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({
            error: `Failed to launch browser: ${error}`
        }, { status: 500 });
    }
}
