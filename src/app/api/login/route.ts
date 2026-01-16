import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { getSessionDir } from '@/lib/session_manager';
import { readConfig } from '@/lib/config';

export async function POST(req: NextRequest) {
    const { platform } = await req.json();

    // 现在只有 NotebookLM 需要浏览器授权
    // B站 使用 SESSDATA Cookie（在配置中设置）
    // YouTube 使用 RSS（无需登录）
    if (platform !== 'notebooklm') {
        return NextResponse.json({
            error: 'Browser login is only needed for NotebookLM. Configure Bilibili SESSDATA in settings.'
        }, { status: 400 });
    }

    const sessionDir = await getSessionDir('notebooklm');
    const config = await readConfig();

    try {
        const context = await chromium.launchPersistentContext(sessionDir, {
            executablePath: config.chrome_exe_path,
            headless: false,
            viewport: null,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--password-store=basic',
                '--window-size=1280,800'
            ],
            ignoreDefaultArgs: [
                '--enable-automation',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--use-mock-keychain'
            ],
        });

        const page = await context.newPage();

        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.goto('https://notebooklm.google.com/');

        // 等待用户关闭浏览器
        await new Promise<void>((resolve) => {
            page.on('close', () => resolve());
            context.on('close', () => resolve());
        });

        await context.close().catch(() => { });

        return NextResponse.json({ success: true, message: 'NotebookLM session saved.' });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({
            error: `Failed to launch browser: ${error}`
        }, { status: 500 });
    }
}

