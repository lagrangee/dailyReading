import path from 'path';
import fs from 'fs/promises';

const SESSIONS_DIR = path.join(process.cwd(), '.sessions');

export async function getSessionDir(platform: 'bilibili' | 'youtube' | 'notebooklm'): Promise<string> {
    const dirName = platform === 'notebooklm' ? 'notebooklm_profile' : platform;
    const dir = path.join(SESSIONS_DIR, dirName);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

export async function sessionExists(platform: 'bilibili' | 'youtube' | 'notebooklm'): Promise<boolean> {
    const dir = await getSessionDir(platform);
    try {
        const files = await fs.readdir(dir);
        // 只有当目录下有实际内容时才认为会话存在
        return files.length > 0;
    } catch {
        return false;
    }
}
