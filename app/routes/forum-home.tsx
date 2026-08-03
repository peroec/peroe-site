import { Component } from "@/forum-bbs/pages/forum-list";
import { clientLoader } from "@/forum-bbs/pages/forum-list";
export { clientLoader };
export const meta = () => [{ title: "论坛 | peroe" }];
export default Component;
export function HydrateFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-24">
      <p className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
        加载中…
      </p>
    </div>
  );
}
