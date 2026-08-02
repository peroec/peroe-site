import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  fetch(request, env, ctx) {
    // 本项目 loader 全部走 fetch 回源 forum.060730.xyz（见 app/lib/api.server.ts），
    // 不需要自定义 context；保留 env/ctx 以备未来绑定。
    void env;
    void ctx;
    return requestHandler(request);
  },
} satisfies ExportedHandler<Env>;
