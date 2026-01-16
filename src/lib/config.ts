import fs from 'fs/promises';
import path from 'path';
import { AppConfig, SourceItem } from './coordinator';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

const DEFAULT_CONFIG: AppConfig = {
    platforms: {
        youtube: { sources: [] },
        bilibili: { sources: [] }
    },
    rss_feeds: [],
    chrome_exe_path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
};

// 将旧的 whitelist 格式转换为新的 sources 格式
function migrateWhitelistToSources(whitelist: string[]): SourceItem[] {
    return whitelist.map(id => ({
        id,
        enabled: true
    }));
}

export async function readConfig(): Promise<AppConfig> {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        const rawConfig = JSON.parse(data);

        let migrated = false;
        const config: any = { ...rawConfig };

        if (!config.platforms) {
            config.platforms = {};
        }

        // 迁移旧的顶级字段
        if (config.youtube_whitelist) {
            config.platforms.youtube = { sources: migrateWhitelistToSources(config.youtube_whitelist) };
            delete config.youtube_whitelist;
            migrated = true;
        }
        if (config.bilibili_whitelist) {
            config.platforms.bilibili = { sources: migrateWhitelistToSources(config.bilibili_whitelist) };
            delete config.bilibili_whitelist;
            migrated = true;
        }

        // 迁移新的 platforms.xxx.whitelist 格式到 sources
        if (config.platforms.youtube?.whitelist && !config.platforms.youtube?.sources) {
            config.platforms.youtube = { sources: migrateWhitelistToSources(config.platforms.youtube.whitelist) };
            migrated = true;
        }
        if (config.platforms.bilibili?.whitelist && !config.platforms.bilibili?.sources) {
            config.platforms.bilibili = { sources: migrateWhitelistToSources(config.platforms.bilibili.whitelist) };
            migrated = true;
        }

        // 清理旧配置
        if (config.hn_config) {
            delete config.hn_config;
            migrated = true;
        }

        if (migrated) {
            await writeConfig(config);
            console.log('[Config] Migrated config to new sources format');
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
