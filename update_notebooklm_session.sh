#!/bin/bash

# NotebookLM 会话更新工具 (原生 Chrome 模式)
# 通过系统 Chrome 登录以获取具有真实指纹的授权目录

echo "=== NotebookLM 会话更新工具 (原生 Chrome 模式) ==="
echo ""
echo "正在启动【原生 Chrome】以授权目录..."
echo "这能彻底避开 Google 对自动化工具的拦截。"

# 准备路径
PROFILE_PATH="$(pwd)/.sessions/notebooklm_profile"
mkdir -p "$PROFILE_PATH"

# 启动系统原生 Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --user-data-dir="$PROFILE_PATH" \
    --no-first-run \
    "https://notebooklm.google.com/"

echo ""
echo "=== 完成！==="
echo "所有登录状态已保存到: ${PROFILE_PATH}"
echo "该目录已被标记为“真实设备”，Playwright 现在可以安全继承它了。"
