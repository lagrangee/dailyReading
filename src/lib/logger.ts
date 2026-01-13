import fs from 'fs/promises';
import path from 'path';

const LOGS_PATH = path.join(process.cwd(), 'logs.json');

export interface LogDetail {
    title: string;
    url: string;
    source: string;
}

export interface LogEntry {
    id: string; // 唯一标识符
    timestamp: string;
    status: 'success' | 'error' | 'none' | 'running';
    message: string;
    linksScraped: number;
    notebookUrl?: string;
    notebookSyncStatus?: 'success' | 'failed' | 'pending'; // NotebookLM 同步状态
    notebookSyncError?: string; // 失败原因
    details?: LogDetail[];
}

export async function readLogs(): Promise<LogEntry[]> {
    try {
        const data = await fs.readFile(LOGS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

export async function addLog(entry: LogEntry): Promise<void> {
    const logs = await readLogs();
    const updated = [entry, ...logs].slice(0, 50);
    await fs.writeFile(LOGS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
}

export async function updateLogById(id: string, updates: Partial<LogEntry>): Promise<void> {
    const logs = await readLogs();
    const index = logs.findIndex(l => l.id === id);
    if (index !== -1) {
        logs[index] = { ...logs[index], ...updates };
        await fs.writeFile(LOGS_PATH, JSON.stringify(logs, null, 2), 'utf-8');
    }
}
