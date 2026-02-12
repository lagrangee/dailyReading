/**
 * 结构化日志工具
 * 输出格式: [时间] [平台] [作者] [标题] [状态] 附加信息
 * 
 * PM2 日志中效果示例:
 * [21:30:05] [YouTube] [lexfr] How AI thinks          ✅ SUCCESS  Transcript: 3200 chars
 * [21:30:12] [Bilibili] [AI深度] Geoffrey Hinton对话    ⏭️ SKIP     No transcript
 * [21:31:00] [NotebookLM] [—] daily_2026_02_12         ✅ SUCCESS  Notebook created
 */

type LogLevel = 'info' | 'success' | 'skip' | 'fail' | 'warn';

const STATUS_ICONS: Record<LogLevel, string> = {
    info: 'ℹ️  INFO   ',
    success: '✅ SUCCESS',
    skip: '⏭️  SKIP   ',
    fail: '❌ FAIL   ',
    warn: '⚠️  WARN   ',
};

function getTimestamp(): string {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncate(str: string, maxLen: number): string {
    if (!str) return '—';
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 1) + '…';
}

function pad(str: string, len: number): string {
    if (str.length >= len) return str;
    return str + ' '.repeat(len - str.length);
}

/**
 * 输出结构化日志行
 * @param platform 平台名 (YouTube / Bilibili / NotebookLM / Main)
 * @param level 日志级别
 * @param opts 可选字段
 */
export function slog(
    platform: string,
    level: LogLevel,
    opts: {
        author?: string;
        title?: string;
        detail?: string;
    } = {}
) {
    const time = getTimestamp();
    const plat = pad(platform, 10);
    const author = pad(truncate(opts.author || '—', 8), 8);
    const title = truncate(opts.title || '', 40);
    const status = STATUS_ICONS[level];
    const detail = opts.detail || '';

    const line = `[${time}] [${plat}] [${author}] ${pad(title, 42)} ${status}  ${detail}`;

    if (level === 'fail') {
        console.error(line);
    } else if (level === 'warn') {
        console.warn(line);
    } else {
        console.log(line);
    }
}

/**
 * 输出分隔线 + 阶段标题
 */
export function slogPhase(phase: string) {
    const time = getTimestamp();
    console.log(`\n[${time}] ══════════ ${phase} ══════════`);
}
