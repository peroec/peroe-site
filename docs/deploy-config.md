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

## 完整配置清单（前端侧）

### .env（构建期，随仓库提交）

| 变量 | 值 | 说明 |
|---|---|---|
| `VITE_BASE_PATH` | `/forum` | 论坛模块挂载路径（勿改） |
| `VITE_FORUM_API_BASE` | `https://forum.060730.xyz` | 论坛 + 交互小说 API 基地址（浏览器端） |

### wrangler.jsonc（运行时）

| 配置 | 值 | 说明 |
|---|---|---|
| `vars.FORUM_API_BASE` | `https://forum.060730.xyz` | SSR 端回源论坛地址 |
| `assets.directory` | `./build/client` | 静态资源目录（构建产物） |
| `account_id` | `115794fc4320d099fff55b1b91999f2c` | Cloudflare 账户 ID |

### site.config.json（站点统一配置）

| 键 | 值 | 说明 |
|---|---|---|
| `forumApiBase` | `https://forum.060730.xyz` | **交互小说也走这个地址**（前端 API 复用） |
| `analytics.shareToken` | 留空 | umami 浏览量回显（生产前填） |
| `authAllowedOrigins` | `https://bbs.060730.xyz` | 跨站登录授权白名单 |

> **交互小说（webnovel）前端无需额外配置**：登录态（forum-auth-token）和 API 地址（forumApiBase）全部复用论坛的。AI 生成/充值配置都在后端（forum-api 的 `.dev.vars` / Cloudflare secrets），详见 forum-api/DEPLOYMENT.md。

## 域名规划表（当前值）

| 用途 | 域名 |
|---|---|
| 大前端主站 | `peroe-main.juluogogo.workers.dev`（示例，正式域名待定） |
| 门户 hub | `hub.060730.xyz` |
| 论坛 API | `forum.060730.xyz` |
| 论坛独立站 | `bbs.060730.xyz`（存留，不维护） |
| 友链/赞助数据 | `fas.060730.xyz` |
| 工具箱文件服务 | `raw-files.2x.nz`（原作者服务） |
| 交互小说 | 无独立域名（走主站 `/webnovel` 路径 + 论坛 API） |
