import type { Config } from "@react-router/dev/config";

export default {
  // 全站 SSR：构建快、首屏直出、SEO 好。
  // 当前流量下免费额度绰绰有余；未来若需零计费/超高并发，
  // 可在此加 prerender 改为 SSG（见 docs/deploy-config.md）。
  ssr: true,
} satisfies Config;
