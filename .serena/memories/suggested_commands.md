Windows PowerShell，在 main-site：
- `pnpm install`
- `pnpm run typecheck`（会先生成博客数据）
- `pnpm build`（generate-posts + react-router build）
- `pnpm dev`（React Router dev；端口被占时自动递增）
- `pnpm deploy` 或设置 CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID 后执行 `pnpm build`、`wrangler deploy`
- `pnpm run cf-typegen`
验证线上：`https://peroe-main.juluogogo.workers.dev/`、`/posts`、`/forum`、`/tier`、`/files`。