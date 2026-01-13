const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  
  // 导出 storage state 到 JSON 文件
  await context.storageState({ path: '.sessions/notebooklm_storage.json' });
  console.log('Storage state exported to .sessions/notebooklm_storage.json');
  
  await browser.close();
})();
