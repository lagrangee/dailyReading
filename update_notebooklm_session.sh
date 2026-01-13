#!/bin/bash

# 更新 NotebookLM 会话的脚本
# 当 NotebookLM 会话过期时运行此脚本

echo "=== NotebookLM 会话更新工具 ==="
echo ""
echo "步骤 1: 启动 Chrome 并登录 NotebookLM"
echo "正在启动 Chrome..."

# 启动带远程调试的 Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --remote-debugging-port=9222 \
    --user-data-dir=/tmp/chrome_debug_notebooklm &

CHROME_PID=$!

echo ""
echo "Chrome 已启动！请在浏览器中："
echo "  1. 访问 https://notebooklm.google.com/"
echo "  2. 完成 Google 登录"
echo ""
read -p "登录完成后，按 Enter 键继续导出会话..."

echo ""
echo "步骤 2: 导出会话..."
node export_storage.js

echo ""
echo "=== 完成！==="
echo "会话已保存到 .sessions/notebooklm_storage.json"
echo ""
echo "您现在可以关闭 Chrome 窗口了。"
