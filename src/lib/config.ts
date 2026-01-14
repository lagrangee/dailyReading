import fs from 'fs/promises';
import path from 'path';
import { AppConfig } from './coordinator';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

const DEFAULT_CONFIG: AppConfig = {
    platforms: {
        youtube: { whitelist: [] },
        bilibili: { whitelist: [] }
    },
    rss_feeds: [],
    chrome_exe_path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
};

export async function readConfig(): Promise<AppConfig> {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        const rawConfig = JSON.parse(data);

        // 迁移逻辑
        let migrated = false;
        const config: any = { ...rawConfig };

        if (!config.platforms) {
            config.platforms = {};
            if (config.youtube_whitelist) {
                config.platforms.youtube = { whitelist: config.youtube_whitelist };
                delete config.youtube_whitelist;
                migrated = true;
            }
            if (config.bilibili_whitelist) {
                config.platforms.bilibili = { whitelist: config.bilibili_whitelist };
                delete config.bilibili_whitelist;
                migrated = true;
            }
            // 移除旧的 hn_config
            if (config.hn_config) {
                delete config.hn_config;
                migrated = true;
            }
        }

        if (migrated) {
            await writeConfig(config);
        }

        return config as AppConfig;
    } catch (e) {
        await writeConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
    }
}

export async function writeConfig(config: AppConfig): Promise<void> {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
