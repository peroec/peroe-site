# 部署文档（main-site / peroe-main）

> 大前端主站（React Router 8 全站 SSR）。Worker 无资源绑定，只需配置环境变量。
> 图例：🔴 **必须**｜🟡 **建议**｜🟢 **可选**

---

## 一、需要绑定的资源

**无。** main-site 是纯 Worker + 静态资产，不依赖 D1/R2/Queue/DO。

---

## 二、环境变量

### 1. Worker 运行时变量（wrangler.jsonc `vars` 或控制台）

| 变量名 | 类型 | 等级 | 说明 |
|---|---|---|---|
| `FORUM_API_BASE` | Var | 🔴 **必须** | 论坛后端回源地址（SSR 端直调），如 `https://forum.060730.xyz`。已在 wrangler.jsonc 默认配置，部署时确认指向正确的后端 |

### 2. Vite 构建期变量（`.env` / 构建时注入，`import.meta.env.VITE_*`）

这些在 `pnpm build` 时写入产物，**在 GitHub Actions / Workers Builds 构建时以环境变量传入**。

| 变量名 | 等级 | 说明 |
|---|---|---|
| `VITE_FORUM_API_BASE` | 🟢 **可选** | 浏览器端论坛 API 基地址，默认 `https://forum.060730.xyz`（本地开发指向 `http://127.0.0.1:8787`） |
| `VITE_SITE_URL` | 🟢 **可选** | 站点对外 URL（SEO/分享卡片），默认取 `app/lib/site.config.json` 的 `url` |
| `VITE_OG_IMAGE` | 🟢 **可选** | 默认分享卡片图片，默认取 `site.config.json` 的 `ogImage` |
| `VITE_BASE_PATH` | 🟢 **可选** | 基础路径前缀，默认空（部署在根域） |
| `VITE_AUTH_ALLOWED_ORIGINS` | 🟢 **可选** | OAuth 授权来源白名单，默认取 `site.config.json` 的 `authAllowedOrigins` |

> 站点信息类（站名/简介/OG 等）改 `app/lib/site.config.json` 即可，不需要环境变量。

---

## 三、部署

```bash
pnpm build          # generate-posts + react-router build
pnpm deploy         # wrangler deploy（含 assets）
```

GitHub 连接可用 Workers Builds：构建命令 `pnpm install && pnpm build && npx wrangler deploy`，
`FORUM_API_BASE` 配到 Actions variables，`VITE_*` 在构建步骤 env 传入。

> 本地开发：`pnpm dev`（Vite dev server，5173），论坛后端连 `http://127.0.0.1:8787`。
