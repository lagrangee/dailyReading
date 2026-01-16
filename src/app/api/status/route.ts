import { NextResponse } from 'next/server';
import { sessionExists } from '@/lib/session_manager';
import { readConfig } from '@/lib/config';

export async function GET() {
    const config = await readConfig();

    // NotebookLM 仍需要 session 认证
    const notebooklmSession = await sessionExists('notebooklm');

    // B站 现在使用 SESSDATA Cookie，检查是否已配置
    const bilibiliConfigured = !!(config.bilibili_sessdata && config.bilibili_sessdata.length > 10);

    return NextResponse.json({
        notebooklm: notebooklmSession,
        bilibili: bilibiliConfigured,  // true = SESSDATA 已配置
        youtube: true  // YouTube 使用 RSS，无需认证
    });
}

