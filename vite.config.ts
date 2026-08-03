import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    reactRouter(),
    tsconfigPaths(),
  ],
  define: {
    // 构建时间（页脚展示真实部署时间；SSR 与客户端同值，无水合差异）
    __BUILD_TIME__: JSON.stringify(new Date().toLocaleString("zh-CN", { hour12: false })),
  },
});
