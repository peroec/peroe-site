# main-site 部署操作流程

大前端主站（React Router 8 Framework Mode 全站 SSR），部署到 Cloudflare Workers。
包含：门户首页、博客（PagesCMS MDX）、论坛（源码级缝合 forum-bbs）、工具箱、友链/赞助。

## 生产域名

| 项目 | 值 |
|---|---|
| 线上地址 | `https://peroe-main.juluogogo.workers.dev`（示例，正式域名待定） |
| Worker 名称 | `peroe-main` |
| 分支 | `main` |

## 1. 构建命令

```bash
pnpm install
pnpm build
```

`pnpm build` 等价执行：

```bash
node scripts/generate-posts.mjs   # 博客内容：content/*.mdx → app/lib/generated-posts.ts
react-router build                # SSR 构建（server + client）
```

> ⚠️ **无需手动构建**：wrangler.jsonc 已内嵌 `"build": { "command": "pnpm install && pnpm build" }`，
> 部署时自动执行。

## 2. 产物

| 项 | 值 |
|---|---|
| SSR 服务端 | `build/server/index.js`（Worker 入口依赖） |
| 静态资源 | `build/client/`（HTML/JS/CSS/图片，Workers Assets 托管） |
| 博客数据 | `app/lib/generated-posts.ts`（构建时生成，162 篇） |
| 论坛模块 | `app/forum-bbs/`（源码级缝合，随构建打包） |

> wrangler.jsonc 的 `assets.directory` 指向 `./build/client`，`main` 指向 `./workers/app.ts`。

## 3. 部署命令

```bash
CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=115794fc4320d099fff55b1b91999f2c pnpm dlx wrangler deploy
```

（构建命令内嵌在 wrangler.jsonc，无需单独配置）

## 4. 需要你设置的内容

| 项 | 说明 |
|---|---|
| Cloudflare API Token | 需要 `Account: Workers Scripts Edit` + `Zone: Workers Routes Edit` 权限 |
| 路由 | 自定义域名绑定 `peroe-main`（或 workers.dev 子域直接用） |
| 正式域名 | 规划后把 `app/lib/site.config.json` 的 `mainSiteUrl` 改成真实域名 |
| 环境变量 | 构建期在 `.env`，运行时在 Worker Settings → Variables（见下方） |

### 环境变量清单

| 变量 | 位置 | 值 |
|---|---|---|
| `VITE_BASE_PATH` | `.env`（构建期） | `/forum`（论坛模块挂载路径，勿改） |
| `VITE_FORUM_API_BASE` | `.env`（构建期） | `https://forum.060730.xyz` |
| `FORUM_API_BASE` | wrangler.jsonc vars | `https://forum.060730.xyz`（SSR 回源） |

### 统一配置

所有域名/站名/统计/社交链接在 **`app/lib/site.config.json`**（唯一配置源，见 `docs/deploy-config.md`）：
- `mainSiteUrl`、`homeUrl`、`forumApiBase`、`forumSiteUrl`、`filesBaseUrl`、`fasOrigin`
- `siteName`、`siteTitle`、`siteAvatar`、`analytics`、`socialLinks`

### 文章浏览量（umami 回显，2026-08-03 新增）

博客文章页浏览量在客户端水合后从 umami 分享 API 查询（SSR 保持 0，不拖慢渲染）：
- 配置在 `site.config.json` → `analytics`：
  - `shareToken`：umami 后台（cloud.umami.is）→ 站点 → 分享 URL 生成的 token，**留空则浏览量不显示**
  - `region`：账号区域 `us` / `eu`（决定 API 域名 `cloud.umami.is/analytics/{region}`）
- 文章路径匹配规则：umami 把 `/posts/xxx` 与 `/posts/xxx/` 视为不同路径，前端查询用 `/posts/<slug>/`（带尾斜杠）

### 赞助名单

`/sponsors` 页面从 `fas.060730.xyz/sponsors.json` 客户端拉取（与友链同机制，1 小时内存缓存），
数据维护在 af_friends-data 仓库 `data/sponsors/`，**更新数据后重新部署 fas 即生效，无需改前端**。

### 交互小说（webnovel，2026-08-04 新增）

- 路由：`/webnovel`（列表）、`/webnovel/:slug`（详情）、`/webnovel/play/:slug`（游玩）、`/webnovel/editor`（创作）、`/webnovel/me`（我的+钱包）
- 后端：集成在 forum-api（`/api/webnovel/api/*`），**登录态复用论坛**（forum-auth-token）
- AI 生成：后端配置 AI_OPENAI_* 或 AI_CF_*（见 forum-api DEPLOYMENT.md）
- 充值：爱发电 webhook 全自动（forum-api 侧配置）
- 前端代码：`app/components/webnovel/`（游玩引擎/列表/详情/编辑器/我的）+ `app/lib/webnovel/`（API/引擎）
- 本地测试：`pnpm dev` 后浏览器切 dev 环境（论坛标题 → 高级设置 → 开发），数据走本地 8787

## 5. 验证

```bash
curl https://<你的域名>/            # 首页 200
curl https://<你的域名>/posts       # 博客列表 200
curl https://<你的域名>/forum       # 论坛 200（客户端渲染）
curl https://<你的域名>/friends     # 友链 200（客户端 fetch 数据）
curl https://<你的域名>/posts/rss.xml  # RSS 200
curl https://<你的域名>/webnovel    # 交互小说列表 200
```

## 6. 关联服务

| 服务 | 域名 | 说明 |
|---|---|---|
| 论坛后端 | `forum.060730.xyz` | peroe-api Worker（D1/R2/DO） |
| 友链数据 | `fas.060730.xyz` | af_friends-data 静态 JSON |
| 门户 | `hub.060730.xyz` | peroe-hub |
| 文件服务 | `raw-files.2x.nz` | 工具箱文件索引（原作者服务） |
