# peroe 大前端部署配置

> **部署前只需改这一个文件**（复制为 `app/lib/site.config.json` 后修改），
> 全部域名、站点名称、统计、社交链接都从这里读取。

## 配置文件：app/lib/site.config.json

```jsonc
{
  "siteName": "peroe",                              // 站点名称（标题/页脚）
  "siteSlogan": "Protect What You Love.",           // 首页 slogan
  "siteDescription": "技术博客 · 社区论坛 · 实用在线工具集",
  "siteTitle": "peroe 官方网站",                     // <title> 主标题
  "siteAvatar": "",                                  // 头像 URL（空=显示首字母占位）

  "mainSiteUrl": "https://peroe-main.juluogogo.workers.dev",  // 大前端主站域名（canonical/分享卡片）
  "homeUrl": "https://hub.060730.xyz",               // 门户站（各子站「返回主页」指向）
  "forumApiBase": "https://forum.060730.xyz",        // 论坛后端 API（peroe-api Worker）
  "forumSiteUrl": "https://bbs.060730.xyz",          // 论坛独立部署地址（SEO canonical）
  "filesBaseUrl": "https://raw-files.2x.nz",         // 工具箱文件索引服务
  "fasOrigin": "https://fas.060730.xyz",              // 友链/赞助数据服务
  "fasRepo": "https://github.com/peroec/af_friends-data", // 友链数据仓库（申请友链指向）

  "analytics": {                                     // 统计脚本（umami），src 留空=关闭
    "src": "https://cloud.umami.is/script.js",
    "websiteId": "842d980c-5e11-4834-a2a8-5daaa285ce66",
    "shareToken": "",                                // umami 分享 URL token（文章浏览量回显用，留空=不显示浏览量）
    "region": "us"                                   // umami 账号区域 us/eu（决定浏览量 API 域名）
  },

  "socialLinks": [                                   // 首页「关注 & 联系」
    { "label": "爱发电", "icon": "heart", "url": "https://..." },
    // icon 可选：heart / video / message / send / github / rss
  ],

  "authAllowedOrigins": "https://bbs.060730.xyz"     // 跨站登录授权白名单（逗号分隔）
}
```

## 修改后需要同步的三处

| 位置 | 说明 |
|---|---|
| `wrangler.jsonc` 的 `vars.FORUM_API_BASE` | SSR 回源论坛地址（与 `forumApiBase` 一致） |
| `.env` 的 `VITE_FORUM_API_BASE` | 论坛前端 API（构建期注入，与 `forumApiBase` 一致） |
| Cloudflare 后台 → peroe-api Worker 的 `OAUTH_REDIRECT_WHITELIST` | GitHub 登录回跳白名单（需含主站与论坛域名） |

## 域名规划表（当前值）

| 用途 | 域名 |
|---|---|
| 大前端主站 | `peroe-main.juluogogo.workers.dev`（示例，正式域名待定） |
| 门户 hub | `hub.060730.xyz` |
| 论坛 API | `forum.060730.xyz` |
| 论坛独立站 | `bbs.060730.xyz`（存留，不维护） |
| 友链/赞助数据 | `fas.060730.xyz` |
| 工具箱文件服务 | `raw-files.2x.nz`（原作者服务） |
