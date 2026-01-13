# 我的需求 每天在notebookLM中查看过去一天更新的AI相关信息
## 信息来源
1. youtube 我的订阅账号
2. hackernews等网站
3. 支持信息源网站可配置
    1. youtube 可提供youtuber名称配置，只抓取白名单
    2. 支持信息源的增删查改
## 信息处理
1. 提取网页链接
2. 登录我的notebookLM账号
3. 在notebookLM中新建一个notebook，名称为 daily_YYYY_MM_DD
4. 在这个notebook中将网页链接作为来源添加，注意youtube视频链接有单独的入口

## 自动化
1. 每天定时触发
2. 完成后通知我