import { Outlet } from "react-router";
import "@/forum-bbs/styles/hljs.css";
import { ThemeProvider } from "@/forum-bbs/components/theme/ThemeProvider";
import { ForumAuthProvider } from "@/forum-bbs/lib/forum/stores/auth";
import { Toaster } from "@/forum-bbs/components/ui/sonner";
import { CodeCopyListener } from "@/forum-bbs/components/code-copy-listener";

/**
 * 论坛布局：把 2xss_bbs 的完整论坛前端缝合进大前端。
 * 页面来自 app/forum-bbs/pages（原样迁移，未重写）——
 * 列表/发帖/详情/登录/注册/个人中心/管理后台全部由原前端提供。
 * 数据加载走 clientLoader（纯客户端，SSR 只渲染骨架）。
 */
export function HydrateFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-24">
      <p className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
        loading forum
      </p>
    </div>
  );
}

export default function ForumLayout() {
  return (
    <ThemeProvider>
      <ForumAuthProvider>
        <div className="flex-1">
          <Outlet />
        </div>
        <Toaster />
        <CodeCopyListener />
      </ForumAuthProvider>
    </ThemeProvider>
  );
}
