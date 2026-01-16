import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const SESSIONS_DIR = path.join(process.cwd(), '.sessions');

export async function getSessionDir(platform: 'bilibili' | 'youtube' | 'notebooklm'): Promise<string> {
    const dirName = `${platform}_profile`;
    const dir = path.join(SESSIONS_DIR, dirName);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

export async function sessionExists(platform: 'bilibili' | 'youtube' | 'notebooklm'): Promise<boolean> {
    const dir = await getSessionDir(platform);
    try {
        // 判定逻辑升级：不仅目录要存在，还得有 Cookies 数据库
        // Playwright 默认将 Cookies 放在 Default/Cookies
        const cookiesPath = path.join(dir, 'Default', 'Cookies');
        const stats = await fs.stat(cookiesPath);
        // 如果文件存在且大于 5KB (基础空库通常很小)，说明可能存有登录信息
        return stats.size > 5120;
    } catch {
        return false;
    }
}

export async function clearSessionLock(platform: 'bilibili' | 'youtube' | 'notebooklm'): Promise<void> {
    const dir = await getSessionDir(platform);
    const lockPath = path.join(dir, 'SingletonLock');
    try {
        if (existsSync(lockPath)) {
            console.log(`[Session] Clearing stale lock file for ${platform}...`);
            await fs.unlink(lockPath);
        }
    } catch (e) {
        console.warn(`[Session] Could not clear lock for ${platform}:`, e);
    }
}
