import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { getSessionDir } from '@/lib/session_manager';
import { readConfig } from '@/lib/config';
import path from 'path';

export async function POST(req: NextRequest) {
    const { platform } = await req.json();

    if (!['bilibili', 'youtube', 'notebooklm'].includes(platform)) {
        return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    // 为不同平台确定会话目录
    let sessionDir: string;
    if (platform === 'notebooklm') {
        // 与 NotebookLMClient 保持一致，使用专门的 profile 目录
        sessionDir = path.join(process.cwd(), '.sessions', 'notebooklm_profile');
    } else {
        sessionDir = await getSessionDir(platform as 'bilibili' | 'youtube');
    }

    try {
        const launchOptions: any = {
            headless: false,
            viewport: { width: 1280, height: 800 },
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
            ],
            ignoreDefaultArgs: ['--enable-automation'],
        };

        // 如果是 NotebookLM，强制使用系统原生 Chrome 以绕过指纹检测
        if (platform === 'notebooklm') {
            const config = await readConfig();
            launchOptions.executablePath = config.chrome_exe_path;
            // 额外添加脚本中的防拦截参数
            launchOptions.ignoreDefaultArgs.push('--no-sandbox', '--disable-setuid-sandbox', '--use-mock-keychain');
            if (!launchOptions.args) launchOptions.args = [];
            launchOptions.args.push('--password-store=basic'); // 关键点：统一存储模式
        } else {
            launchOptions.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        }

        const context = await chromium.launchPersistentContext(sessionDir, launchOptions);

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

        // 等待用户关闭授权页面
        await new Promise<void>((resolve) => {
            page.on('close', () => resolve());
            context.on('close', () => resolve()); // 保险起见，同时也监听 context
        });

        // 尝试正常关闭 context 以清理资源
        await context.close().catch(() => { });

        return NextResponse.json({ success: true, message: `${platform} session saved.` });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({
            error: `Failed to launch browser: ${error}`
        }, { status: 500 });
    }
}
