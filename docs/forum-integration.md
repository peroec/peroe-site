# 论坛前端缝合说明（2xss_bbs → main-site）

> 本文档记录如何把独立论坛前端仓库（2xss_bbs / peroe-bbs）完整缝入大前端
> main-site（React Router 8 Framework Mode 全站 SSR），以及后续复用的全部要点。

## 背景与目标

main-site 是自研的 React Router 8 全站 SSR 大前端。论坛部分**不重新实现**，
直接把已有完整论坛前端（列表/发帖/详情/登录/注册/个人中心/管理后台/评论流
SSE 等）源码级迁入，保持功能 100% 完整。

## 目录结构

```
main-site/
├── app/
│   ├── forum-bbs/                  # ← 论坛前端源码（原 2xss_bbs/src 迁移）
│   │   ├── pages/                  #   路由页面（14 个，Component 形态）
│   │   ├── app/                    #   页面组件（forum/page、post/、auth/ 等）
│   │   ├── components/             #   UI 组件库（icon/button/dialog/...）
│   │   ├── lib/                    #   论坛 API 客户端、store、工具
│   │   ├── styles/hljs.css         #   代码高亮样式
│   │   ├── globals.css             #   论坛 Tailwind v4 主题（CSS 变量）
│   │   └── site.config.json        #   论坛站点配置
│   └── routes/
│       ├── forum-layout.tsx        # 论坛布局（Provider 包裹）
│       ├── forum-home.tsx          # wrapper → forum-bbs/pages/forum-list
│       └── forum-page-*.tsx        # 13 个页面 wrapper
└── routes.ts                       # /forum 子路由注册
```

## 迁移步骤（复用流程）

### 1. 复制源码

```bash
# 从源仓库复制（src 下 5 个核心目录）
cp -r 2xss_bbs/src/pages      main-site/app/forum-bbs/pages
cp -r 2xss_bbs/src/components main-site/app/forum-bbs/components
cp -r 2xss_bbs/src/lib        main-site/app/forum-bbs/lib
cp -r 2xss_bbs/src/app/forum  main-site/app/forum-bbs/app
cp -r 2xss_bbs/src/styles     main-site/app/forum-bbs/styles
cp    2xss_bbs/src/app/globals.css main-site/app/forum-bbs/globals.css
cp    2xss_bbs/src/site.config.json main-site/app/forum-bbs/site.config.json
```

### 2. 重写 import 前缀

源码用 `@/` 别名（原指向 `src/`）。迁入后需改为 `@/forum-bbs/`：

```js
// 遍历 forum-bbs 下所有 .tsx/.ts，执行：
content = content.replace(/(['"])@\/(?!forum-bbs\/)([^'"]+)\1/g,
  (m, q, rest) => `${q}@/forum-bbs/${rest}${q}`);
```

注意：
- `app/forum/` 目录复制后路径变为 `app/forum-bbs/app/`，页面里对
  `@/app/forum/xxx` 的引用需再处理一层：`@/forum-bbs/app/forum/` → `@/forum-bbs/app/`
- 个别文件可能漏网，用正则复查 `['"]@/(?!forum-bbs/)[a-z]`

### 3. 配置别名

main-site `tsconfig.json` 的 `paths` 增加 `@/*`（原只有 `~/*`）：

```json
"paths": { "~/*": ["./app/*"], "@/*": ["./app/*"] }
```

vite.config.ts 已用 `vite-tsconfig-paths`，自动读取。

### 4. 安装依赖

论坛前端独有的依赖（main-site 没有的）：

```bash
pnpm add @iconify/react @marsidev/react-turnstile browser-image-compression \
  dompurify markdown-it mermaid qrcode sonner tailwind-merge clsx
pnpm add -D @types/markdown-it @types/qrcode @iconify-json/mdi @iconify-json/ri \
  @fontsource-variable/geist @fontsource-variable/geist-mono
```

### 5. loader → clientLoader（关键）

main-site 是 SSR，论坛页面是纯客户端数据路由。**论坛页面不能跑服务端 loader**
（涉及 window/localStorage），必须转成 clientLoader：

```js
// 每个 pages/*.tsx：
export async function loader(...)  →  export async function clientLoader(...)
// 并在函数后追加（首次加载也调用）：
clientLoader.hydrate = true as const;
```

### 6. 论坛布局（Provider 包裹）

`app/routes/forum-layout.tsx` 提供论坛所需 Context：

```tsx
<ThemeProvider>          // forum-bbs/components/theme/ThemeProvider
  <ForumAuthProvider>    // forum-bbs/lib/forum/stores/auth
    <Outlet />
    <Toaster />          // forum-bbs/components/ui/sonner
    <CodeCopyListener />
  </ForumAuthProvider>
</ThemeProvider>
```

### 7. 注册路由

`routes.ts`：

```ts
route("forum", "routes/forum-layout.tsx", [
  index("routes/forum-home.tsx"),
  route("post/new", "routes/forum-page-new.tsx"),
  route("post/:id", "routes/forum-page-detail.tsx"),
  route("auth/login", "routes/forum-page-login.tsx"),
  // ... 其余页面
])
```

每个 wrapper（forum-page-*.tsx）内容：

```tsx
import { Component } from "@/forum-bbs/pages/post-detail";
import { clientLoader } from "@/forum-bbs/pages/post-detail"; // 仅有的页面
export { clientLoader };                                     // 仅有的页面
export const meta = () => [{ title: "论坛 | peroe" }];
export default Component;
```

> 只有 forum-list / post-detail 有 clientLoader，其余页面不 re-export。

## 适配点清单

| 项 | 原值 | 现值 | 位置 |
|---|---|---|---|
| 论坛 API 地址 | `https://i.2x.nz` | `https://forum.060730.xyz` | `forum-bbs/lib/forum/api/client.ts` 的 `FORUM_API_BASE_URLS.prod`（`VITE_FORUM_API_BASE` 可覆盖） |
| TS 类型 | — | `res.json()` 需断言 `as Record<string, any>` | 同上文件 `forumRequest` 内 `body`/`data` |
| `@` 别名 | `./src/*` | `./app/*` | `tsconfig.json` paths |
| 页面导出 | `loader` | `clientLoader` + `hydrate` | `forum-bbs/pages/*.tsx` |

## 注意事项 / 坑

1. **basename**：2xss_bbs 用 `createBrowserRouter` + `ROUTER_BASENAME`（VITE_BASE_PATH）。
   缝入后路由由 main-site 统一管理，`base-path.ts` 的 `withBase()` 仍被 API 客户端
   用于登录跳转，`BASE_PATH` 保持空字符串（站点根）即可。
2. **图标**：`components/ui/icon.tsx` 用构建期 subset.json 摊平 + SSR 安全设计，
   不依赖 Iconify 运行时（仅未收录图标动态 import 兜底）。
3. **样式冲突**：forum-bbs/globals.css 是 Tailwind v4 `@theme` + CSS 变量（oklch 体系），
   与 main-site app.css 的 `@theme`（十六进制）**会冲突**——后者先定义前者覆盖。
   若论坛页面视觉异常，检查 CSS 变量优先级。
4. **SSR 安全性**：迁移的页面在 SSR 阶段只渲染布局骨架（clientLoader 不跑），
   页面组件内不得有顶层 `window` 访问（getBaseUrl/getToken 已做 typeof 防护）。
5. **环境变量**：`VITE_FORUM_API_BASE` 构建期注入；生产默认 forum.060730.xyz。
6. **删除旧版**：若之前有自研简化论坛路由（forum._index.tsx 等），需删除，
   避免与 forum-bbs 页面冲突。

## 复用（新增/更新论坛功能）

- 直接改 `app/forum-bbs/` 下的源码，与独立仓库保持同源。
- 新增页面：在 `forum-bbs/pages/` 加 Component，`routes.ts` 注册 + 建 wrapper。
- 升级源仓库后同步：重复步骤 1-2（复制 + import 重写），保留 main-site 侧适配
  （clientLoader 转换、API base、类型断言）。

## 验证命令

```bash
pnpm run typecheck   # 确认无 TS 错误
pnpm build           # 确认 SSR 构建通过
pnpm dev             # 本地访问 /forum、/forum/post/1、/forum/auth/login
```
