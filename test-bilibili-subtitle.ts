/**
 * B站字幕诊断脚本
 * 
 * 用途：排查 B 站视频字幕无法解析的原因
 * 检查项：
 *   1. SESSDATA 是否配置
 *   2. SESSDATA 是否有效（登录态检查）
 *   3. 视频信息是否正常获取
 *   4. 字幕列表 API 是否正常返回
 *   5. 字幕内容下载是否正常
 * 
 * 用法: npx tsx test-bilibili-subtitle.ts [可选的BV号]
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ====== 颜色输出 ======
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function ok(msg: string) { console.log(`${GREEN}✅ ${msg}${RESET}`); }
function fail(msg: string) { console.log(`${RED}❌ ${msg}${RESET}`); }
function warn(msg: string) { console.log(`${YELLOW}⚠️  ${msg}${RESET}`); }
function info(msg: string) { console.log(`${CYAN}ℹ️  ${msg}${RESET}`); }
function header(msg: string) { console.log(`\n${BOLD}========== ${msg} ==========${RESET}`); }

// ====== 常量 ======
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEFAULT_TEST_BVID = 'BV1L1421S7a6'; // 一个公开的 B 站视频用于测试

// ====== WBI 签名相关 ======
const mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 54, 40,
    63, 65, 62, 21, 51, 55, 30, 61, 26, 64, 52, 22, 11, 25, 34, 17, 36, 1, 6,
    4, 44, 0, 60, 20, 59
];

function getMixinKey(ae: string) {
    let s = "";
    mixinKeyEncTab.forEach((item) => { s += ae[item]; });
    return s.slice(0, 32);
}

// ====== 主测试流程 ======
async function main() {
    const argBvid = process.argv[2]; // 可选，传入 BV 号
    const testBvid = argBvid || DEFAULT_TEST_BVID;

    console.log(`${BOLD}🔍 B站字幕诊断脚本${RESET}`);
    console.log(`   测试时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`   测试 BV 号: ${testBvid}`);

    // ====== Step 1: 读取配置 ======
    header('Step 1: 检查 SESSDATA 配置');

    const configPath = path.join(process.cwd(), 'config.json');
    let sessdata = '';

    if (!fs.existsSync(configPath)) {
        fail('找不到 config.json 文件');
        process.exit(1);
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        sessdata = config.bilibili_sessdata || '';

        if (!sessdata) {
            fail('config.json 中没有 bilibili_sessdata 字段');
            process.exit(1);
        }

        ok(`SESSDATA 已配置 (前20字符: ${sessdata.substring(0, 20)}...)`);
        info(`SESSDATA 长度: ${sessdata.length} 字符`);

        // 检查 SESSDATA 格式（通常包含 %2C）
        if (sessdata.includes('%2C')) {
            ok('SESSDATA 格式看起来正常（包含 URL 编码的逗号）');
        } else {
            warn('SESSDATA 格式可能不正常（不包含 %2C），但不一定是问题');
        }
    } catch (e: any) {
        fail(`读取 config.json 失败: ${e.message}`);
        process.exit(1);
    }

    // ====== Step 2: 验证登录态 ======
    header('Step 2: 验证 SESSDATA 登录态');

    try {
        const navRes = await fetch('https://api.bilibili.com/x/web-interface/nav', {
            headers: {
                'User-Agent': UA,
                'Cookie': `SESSDATA=${sessdata}`,
                'Referer': 'https://www.bilibili.com/'
            }
        });
        const navData = await navRes.json();

        info(`Nav API 响应码: ${navData.code}`);

        if (navData.code === 0 && navData.data?.isLogin) {
            ok(`登录态有效！用户: ${navData.data.uname} (UID: ${navData.data.mid})`);
            info(`VIP 类型: ${navData.data.vipType === 0 ? '无' : navData.data.vipType === 1 ? '月度大会员' : '年度大会员'}`);

            // 检查 WBI keys
            if (navData.data.wbi_img) {
                ok('WBI 密钥可获取');
                const imgKey = navData.data.wbi_img.img_url.split('/').pop().split('.')[0];
                const subKey = navData.data.wbi_img.sub_url.split('/').pop().split('.')[0];
                info(`img_key: ${imgKey}`);
                info(`sub_key: ${subKey}`);
            }
        } else if (navData.code === 0 && !navData.data?.isLogin) {
            fail('SESSDATA 已失效！用户未登录状态');
            fail('👉 需要重新获取 SESSDATA Cookie');
            info('获取方法: 浏览器登录 bilibili.com → F12 打开开发者工具 → Application → Cookies → 复制 SESSDATA 值');
        } else {
            fail(`Nav API 返回异常: code=${navData.code}, message=${navData.message}`);
        }
    } catch (e: any) {
        fail(`请求 Nav API 失败: ${e.message}`);
        warn('可能是网络问题，请检查网络连接');
    }

    // ====== Step 3: 获取视频信息 ======
    header('Step 3: 获取视频信息');

    let aid: number | null = null;
    let cid: number | null = null;
    let videoTitle = '';

    try {
        const viewRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${testBvid}`, {
            headers: {
                'User-Agent': UA,
                'Cookie': `SESSDATA=${sessdata}`,
                'Referer': 'https://www.bilibili.com/'
            }
        });
        const viewData = await viewRes.json();

        info(`View API 响应码: ${viewData.code}`);

        if (viewData.code === 0) {
            const d = viewData.data;
            aid = d.aid;
            cid = d.cid;
            videoTitle = d.title;

            ok(`视频信息获取成功`);
            info(`标题: ${d.title}`);
            info(`UP主: ${d.owner?.name} (UID: ${d.owner?.mid})`);
            info(`AID: ${aid}`);
            info(`CID: ${cid}`);
            info(`时长: ${Math.floor(d.duration / 60)}分${d.duration % 60}秒`);
            info(`播放量: ${d.stat?.view}`);

            // 检查视频本身是否有字幕信息
            if (d.subtitle && d.subtitle.list && d.subtitle.list.length > 0) {
                ok(`视频信息中包含字幕列表 (${d.subtitle.list.length} 条)`);
                d.subtitle.list.forEach((s: any) => {
                    info(`  - ${s.lan_doc} (${s.lan})`);
                });
            } else {
                warn('视频信息中没有直接包含字幕列表（这是正常的，需要通过 Player API 获取）');
            }
        } else {
            fail(`获取视频信息失败: code=${viewData.code}, message=${viewData.message}`);
            if (viewData.code === -404) {
                fail('视频不存在，请检查 BV 号是否正确');
            }
        }
    } catch (e: any) {
        fail(`请求 View API 失败: ${e.message}`);
    }

    // ====== Step 4: 获取字幕列表 ======
    header('Step 4: 获取字幕列表 (Player API)');

    if (!aid || !cid) {
        fail('由于视频信息获取失败，跳过字幕获取');
    } else {
        try {
            // 方式 1: 直接请求 (不带 WBI 签名)
            info('尝试方式 1: 直接请求 /x/player/wbi/v2 ...');

            const playerUrl = `https://api.bilibili.com/x/player/wbi/v2?cid=${cid}&aid=${aid}&bvid=${testBvid}`;
            const playerRes = await fetch(playerUrl, {
                headers: {
                    'Cookie': `SESSDATA=${sessdata}`,
                    'User-Agent': UA,
                    'Referer': `https://www.bilibili.com/video/${testBvid}/`
                }
            });
            const playerData = await playerRes.json();

            info(`Player API 响应码: ${playerData.code}`);
            info(`Player API 消息: ${playerData.message || '(无)'}`);

            if (playerData.code === 0) {
                const subtitles = playerData.data?.subtitle?.subtitles || [];

                if (subtitles.length > 0) {
                    ok(`🎉 找到 ${subtitles.length} 条字幕！`);
                    for (const sub of subtitles) {
                        info(`  - ${sub.lan_doc} (${sub.lan}) 地址: ${sub.subtitle_url?.substring(0, 60)}...`);
                    }
                } else {
                    warn('Player API 返回成功，但字幕列表为空');
                    info('可能原因:');
                    info('  1. 该视频确实没有字幕（UP 主未上传/未生成 AI 字幕）');
                    info('  2. SESSDATA 登录态虽然未过期但权限不足');
                    info('  3. 需要 WBI 签名才能获取字幕');

                    // 打印完整的 subtitle 字段用于调试
                    info(`完整 subtitle 字段: ${JSON.stringify(playerData.data?.subtitle)}`);
                }

                // ====== Step 5: 下载字幕内容 ======
                if (subtitles.length > 0) {
                    header('Step 5: 下载字幕内容');

                    const targetSub = subtitles.find((s: any) => s.lan === 'zh-Hans') || subtitles[0];
                    info(`选择字幕: ${targetSub.lan_doc} (${targetSub.lan})`);

                    try {
                        const subUrl = targetSub.subtitle_url.startsWith('//')
                            ? `https:${targetSub.subtitle_url}`
                            : targetSub.subtitle_url;

                        const subRes = await fetch(subUrl, {
                            headers: {
                                'User-Agent': UA,
                                'Referer': 'https://www.bilibili.com/'
                            }
                        });
                        const subData = await subRes.json();

                        if (subData.body && subData.body.length > 0) {
                            const transcript = subData.body.map((item: any) => item.content).join('\n');
                            ok(`字幕下载成功！共 ${subData.body.length} 条，${transcript.length} 字符`);
                            info(`前 200 字预览:\n${transcript.substring(0, 200)}...`);
                        } else {
                            fail('字幕文件内容为空');
                        }
                    } catch (e: any) {
                        fail(`字幕下载失败: ${e.message}`);
                    }
                }
            } else if (playerData.code === -403) {
                fail('Player API 返回 403 (权限不足)，SESSDATA 可能已过期');
                fail('👉 需要重新获取 SESSDATA');
            } else {
                fail(`Player API 返回异常: code=${playerData.code}, message=${playerData.message}`);

                // 如果是 -352 可能需要 WBI 签名
                if (playerData.code === -352) {
                    warn('返回 -352 错误，可能需要 WBI 签名');
                    info('尝试方式 2: 使用 WBI 签名请求...');

                    try {
                        // 获取 WBI keys
                        const navRes2 = await fetch('https://api.bilibili.com/x/web-interface/nav', {
                            headers: {
                                'User-Agent': UA,
                                'Cookie': `SESSDATA=${sessdata}`,
                            }
                        });
                        const navData2 = await navRes2.json();

                        if (navData2.data?.wbi_img) {
                            const imgKey = navData2.data.wbi_img.img_url.split('/').pop().split('.')[0];
                            const subKey = navData2.data.wbi_img.sub_url.split('/').pop().split('.')[0];
                            const mixinKey = getMixinKey(imgKey + subKey);
                            const currTime = Math.round(Date.now() / 1000);

                            const params: Record<string, any> = {
                                cid,
                                aid,
                                bvid: testBvid,
                                wts: currTime
                            };

                            const chrFilter = /[!'()*]/g;
                            const query: string[] = [];
                            Object.keys(params).sort().forEach((key) => {
                                let val = params[key].toString().replace(chrFilter, '');
                                query.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
                            });
                            const queryString = query.join('&');
                            const wRid = crypto.createHash('md5').update(queryString + mixinKey).digest('hex');
                            const signedUrl = `https://api.bilibili.com/x/player/wbi/v2?${queryString}&w_rid=${wRid}`;

                            const signedRes = await fetch(signedUrl, {
                                headers: {
                                    'Cookie': `SESSDATA=${sessdata}`,
                                    'User-Agent': UA,
                                    'Referer': `https://www.bilibili.com/video/${testBvid}/`
                                }
                            });
                            const signedData = await signedRes.json();

                            info(`WBI 签名请求响应码: ${signedData.code}`);

                            if (signedData.code === 0) {
                                const subs2 = signedData.data?.subtitle?.subtitles || [];
                                if (subs2.length > 0) {
                                    ok(`🎉 通过 WBI 签名找到 ${subs2.length} 条字幕！`);
                                    warn('说明: 主程序的 Player API 请求可能缺少 WBI 签名');
                                } else {
                                    warn('WBI 签名请求也没有返回字幕');
                                }
                            } else {
                                fail(`WBI 签名请求也失败: ${signedData.message}`);
                            }
                        }
                    } catch (e: any) {
                        fail(`WBI 签名请求失败: ${e.message}`);
                    }
                }
            }
        } catch (e: any) {
            fail(`请求 Player API 失败: ${e.message}`);
        }
    }

    // ====== 额外检查: 用白名单里的视频测试 ======
    header('Step 6: 使用配置中 UP 主的最新视频测试');

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const sources = config.platforms?.bilibili?.sources || [];

        if (sources.length === 0) {
            warn('配置中没有 B 站订阅源');
        } else {
            const source = sources.find((s: any) => s.enabled) || sources[0];
            info(`使用 UP 主: ${source.name || source.id} (mid: ${source.id})`);

            // 获取 WBI keys
            const navRes3 = await fetch('https://api.bilibili.com/x/web-interface/nav', {
                headers: { 'User-Agent': UA, 'Cookie': `SESSDATA=${sessdata}` }
            });
            const navData3 = await navRes3.json();
            const imgKey = navData3.data?.wbi_img?.img_url.split('/').pop().split('.')[0];
            const subKey3 = navData3.data?.wbi_img?.sub_url.split('/').pop().split('.')[0];

            if (!imgKey || !subKey3) {
                fail('无法获取 WBI 密钥，跳过此测试');
            } else {
                // 构建签名请求
                const mixinKey = getMixinKey(imgKey + subKey3);
                const currTime = Math.round(Date.now() / 1000);
                const params: Record<string, any> = {
                    mid: source.id,
                    ps: 3,
                    pn: 1,
                    platform: 'web',
                    web_location: 1550101,
                    order: 'pubdate',
                    wts: currTime
                };

                const chrFilter = /[!'()*]/g;
                const query: string[] = [];
                Object.keys(params).sort().forEach((key) => {
                    let val = params[key].toString().replace(chrFilter, '');
                    query.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
                });
                const queryString = query.join('&');
                const wRid = crypto.createHash('md5').update(queryString + mixinKey).digest('hex');
                const spaceUrl = `https://api.bilibili.com/x/space/wbi/arc/search?${queryString}&w_rid=${wRid}`;

                const spaceRes = await fetch(spaceUrl, {
                    headers: {
                        'User-Agent': UA,
                        'Referer': `https://space.bilibili.com/${source.id}/video`,
                        'Cookie': `SESSDATA=${sessdata}`
                    }
                });
                const spaceData = await spaceRes.json();

                if (spaceData.code === 0) {
                    const vlist = spaceData.data?.list?.vlist || [];
                    ok(`获取到 ${vlist.length} 条最新视频`);

                    if (vlist.length > 0) {
                        const latestVideo = vlist[0];
                        info(`最新视频: ${latestVideo.title} (${latestVideo.bvid})`);
                        info(`时长: ${latestVideo.length}`);

                        // 获取这个视频的字幕
                        const viewRes2 = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${latestVideo.bvid}`, {
                            headers: { 'User-Agent': UA, 'Cookie': `SESSDATA=${sessdata}`, 'Referer': 'https://www.bilibili.com/' }
                        });
                        const viewData2 = await viewRes2.json();

                        if (viewData2.code === 0) {
                            const playerRes2 = await fetch(
                                `https://api.bilibili.com/x/player/wbi/v2?cid=${viewData2.data.cid}&aid=${viewData2.data.aid}&bvid=${latestVideo.bvid}`,
                                {
                                    headers: {
                                        'Cookie': `SESSDATA=${sessdata}`,
                                        'User-Agent': UA,
                                        'Referer': `https://www.bilibili.com/video/${latestVideo.bvid}/`
                                    }
                                }
                            );
                            const playerData2 = await playerRes2.json();

                            if (playerData2.code === 0) {
                                const subs = playerData2.data?.subtitle?.subtitles || [];
                                if (subs.length > 0) {
                                    ok(`🎉 最新视频有 ${subs.length} 条字幕，字幕功能正常！`);
                                } else {
                                    warn(`最新视频也没有字幕`);
                                    info(`subtitle 字段: ${JSON.stringify(playerData2.data?.subtitle)}`);
                                }
                            } else {
                                fail(`Player API 对最新视频也返回错误: ${playerData2.code} - ${playerData2.message}`);
                            }
                        }
                    }
                } else {
                    fail(`获取 UP 主视频列表失败: ${spaceData.code} - ${spaceData.message}`);
                }
            }
        }
    } catch (e: any) {
        fail(`UP 主视频测试失败: ${e.message}`);
    }

    // ====== 总结 ======
    header('诊断总结');
    console.log(`
${BOLD}常见问题排查:${RESET}
  ${YELLOW}1. SESSDATA 过期${RESET}
     → 登录态检查失败 / Player API 返回空字幕
     → 解决: 浏览器重新登录 B 站，获取新的 SESSDATA
     
  ${YELLOW}2. 视频无 AI 生成字幕${RESET}
     → 某些视频（尤其是短视频）可能没有 AI 字幕
     → 用多个不同视频测试确认
     
  ${YELLOW}3. 网络问题${RESET}
     → API 请求超时或连接失败
     → 检查服务器网络 / 代理配置
     
  ${YELLOW}4. WBI 签名问题${RESET}
     → -352 错误，签名算法可能需要更新
     → B 站可能更新了 WBI 签名算法

  ${CYAN}提示: 可以传入 BV 号测试特定视频${RESET}
  ${CYAN}用法: npx tsx test-bilibili-subtitle.ts BV1xxxxxxxxx${RESET}
`);
}

main().catch(e => {
    console.error(`${RED}脚本执行出错:${RESET}`, e);
    process.exit(1);
});
