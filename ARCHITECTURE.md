# main-site 架构设计

> 大前端主站（React Router 8 Framework Mode 全站 SSR），部署到 Cloudflare Workers。
> 聚合：门户首页、博客、论坛（源码级缝合）、工具箱、友链/赞助。
> 本文说明：**怎么设计、怎么运行、为什么这么设计**。

## 一、设计概览

```
浏览器
  ▼
peroe-main Worker（React Router 8 SSR + Workers Assets）
  ├── /            门户首页
  ├── /posts       博客（构建期生成内容，PagesCMS 管理）
  ├── /forum       论坛（源码级缝合 forum-bbs，clientLoader 客户端取数）
  ├── /friends     友链（客户端 fetch fas.060730.xyz）
  ├── /sponsors    赞助（客户端 fetch fas.060730.xyz）
  ├── /cover /watermark /bilibili-cover /files  工具箱
  └── /u/:id       论坛用户主页（调 peroe-api）
  │
  ├── 回源 peroe-api（SSR 数据）
  ├── 回源 fas（友链/赞助静态 JSON）
  └── 外部：umami（统计+浏览量）、Giscus（评论）、B站 API（封面工具）
```

**核心设计原则**：
1. **全站 SSR**：React Router 8 Framework Mode，SEO 友好、无 JS 可用
2. **单一配置源**：`site.config.json` 集中所有域名/统计/社交配置
3. **论坛源码级缝合**：forum-bbs 是唯一真源，随主站构建打包
4. **SSR 零重活**：代码高亮/浏览量/论坛数据全部客户端处理，SSR 只出壳

## 二、运行流程

### 2.1 页面渲染（SSR）
1. 请求 → Worker → React Router loader（SSR 端）
2. 博客页：`posts.server.ts` 读构建期生成的 `generated-posts.ts`（内存数据）
3. 论坛页：`clientLoader`（hydrate=true）→ 浏览器水合后取数，SSR 只出 HydrateFallback
4. 输出：SSR HTML + 客户端 JS 水合

### 2.2 博客数据流
```
content/*.mdx（af_blog-data，PagesCMS）
  → scripts/generate-posts.mjs（构建期）
  → app/lib/generated-posts.ts（内存数据，162 篇）
  → posts.server.ts（列表/详情/搜索）
  → 文章页：客户端 hljs 高亮 + umami 浏览量回显 + Giscus 评论
```

### 2.3 论坛缝合
- `app/forum-bbs/` 是论坛唯一真源（从独立站迁移，见 docs/forum-integration.md）
- 13 个 wrapper（forum-page-*.tsx）映射到论坛页面
- 数据：clientLoader 客户端调 peroe-api（回源 forum.060730.xyz）
- 公告/渠道策略/通知偏好在论坛后台管理

### 2.4 友链/赞助
```
af_friends-data 仓库（data/*.json）
  → build.js 聚合 → dist/friends.json + sponsors.json
  → 部署 fas Worker（fas.060730.xyz）
  → 主站客户端 fetch（useFasData，1 小时内存缓存）
```

### 2.5 文章浏览量（2026-08-03）
```
客户端水合 → fetchUmamiPageviews(`/posts/<slug>/`)
  → umami 分享 API（share token + path=eq. 精确匹配）
  → 填充浏览量（SSR 保持 0，不拖慢）
配置：site.config.json analytics.shareToken（未配置则隐藏）
```

## 三、设计目的

| 设计 | 目的 |
|---|---|
| 全站 SSR | SEO（爬虫不执行 JS 也能抓内容）+ 分享卡片正确 |
| 博客构建期生成 | 无运行时数据库，零查询成本，PagesCMS 写文件即发布 |
| 论坛 clientLoader | 论坛动态数据不需要 SSR 预取，客户端取数减轻 API 压力 |
| 客户端高亮 | hljs 是重量库，放 SSR 会拖慢每个页面（此前实测） |
| 单一 site.config.json | 域名/统计换环境只改一个文件（部署文档） |
| forum-bbs 源码缝合 | 论坛和主站共用登录态/样式/构建，不再维护独立站 |
| 1 小时内存缓存（fas） | 友链数据低频变动，避免每次页面重复请求 |

## 四、目录结构

```
app/
├── routes.ts          路由注册（forum 13 wrapper + 主站路由）
├── root.tsx           根布局 + 统计脚本注入
├── routes/            页面路由（posts.$slug/forum-*/tools.*/friends/sponsors/anime...）
├── forum-bbs/         论坛缝合源（唯一真源）
│   ├── app/           论坛页面（含管理后台/个人中心/公告）
│   ├── pages/         clientLoader wrapper
│   ├── lib/           论坛 API client/types/map 函数
│   └── components/    共享 UI
├── components/        主站组件（Footer/Giscus/ArticleTableOfContents...）
├── lib/
│   ├── site.ts        site.config.json 读取（单一配置源）
│   ├── site.config.json  部署配置（域名/统计/社交/umami）
│   ├── posts.server.ts   博客数据服务
│   ├── generated-posts.ts 构建产物（博客内容）
│   ├── markdown.ts    渲染（SSR 纯文本 + 客户端高亮标记）
│   ├── umami-views.ts 浏览量客户端查询
│   └── fas.ts         友链/赞助 fetch + 缓存
└── styles/  assets/   样式与静态资源
```

## 五、部署要点

- Worker：`peroe-main`，域名 `peroe-main.juluogogo.workers.dev`
- 构建：`pnpm build`（generate-posts + react-router build）→ Workers Assets
- 环境：`.env`（构建期 VITE_*）+ wrangler vars（SSR 回源）
- 配置：`site.config.json`（唯一部署配置源）
- 详见 `DEPLOYMENT.md` / `docs/deploy-config.md`
