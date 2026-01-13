import fs from 'fs/promises';
import path from 'path';

const HISTORY_PATH = path.join(process.cwd(), 'history.json');

export async function readHistory(): Promise<string[]> {
    try {
        const data = await fs.readFile(HISTORY_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

export async function addToHistory(urls: string[]): Promise<void> {
    const history = await readHistory();
    const updated = Array.from(new Set([...history, ...urls]));
    // 仅保留最近的 1000 条记录以节省空间
    const limited = updated.slice(-1000);
    await fs.writeFile(HISTORY_PATH, JSON.stringify(limited, null, 2), 'utf-8');
}
