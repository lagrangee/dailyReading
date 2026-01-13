import path from 'path';
import fs from 'fs/promises';

const SESSIONS_DIR = path.join(process.cwd(), '.sessions');

export async function getSessionDir(platform: 'bilibili' | 'youtube' | 'notebooklm'): Promise<string> {
    const dir = path.join(SESSIONS_DIR, platform);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

export async function sessionExists(platform: 'bilibili' | 'youtube' | 'notebooklm'): Promise<boolean> {
    const dir = await getSessionDir(platform);
    try {
        const files = await fs.readdir(dir);
        return files.length > 0;
    } catch {
        return false;
    }
}
