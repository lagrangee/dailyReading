import fs from 'fs/promises';
import path from 'path';
import { AppConfig } from './coordinator';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

const DEFAULT_CONFIG: AppConfig = {
    youtube_whitelist: [],
    bilibili_whitelist: [],
    rss_feeds: [],
    chrome_exe_path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    hn_config: {
        keywords: ['AI', 'LLM', 'Machine Learning', 'OpenAI', 'Anthropic'],
        minPoints: 100,
        maxResults: 3
    }
};

export async function readConfig(): Promise<AppConfig> {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        await writeConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
    }
}

export async function writeConfig(config: AppConfig): Promise<void> {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
