import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import ForumPage, { type ForumInitialData } from "@/forum-bbs/app/page";
import { getPosts, getCategories } from "@/forum-bbs/lib/forum/api/client";
import { useSeo } from "@/forum-bbs/lib/seo/use-seo";

const PER_PAGE = 20;

/**
 * 列表页数据 —— 原来是 SSR loader（app/routes/forum_.server.ts），现在原地搬到
 * 浏览器里跑，取数逻辑一字未改：URL 上的 page/search/sort/category 直接喂给
 * 论坛 API，排序映射表也仍是 client.ts 里那一份。
 *
 * 之所以要有 loader 而不是让组件自己 useEffect 拉：筛选条件全在 URL 上，
 * 翻页/搜索/排序都是真链接和 GET 表单，交给数据路由才能保持
 * 「改 URL → 重新取数 → useNavigation 出骨架屏」这一套原样可用。
 */
export async function clientLoader({ request }: LoaderFunctionArgs): Promise<ForumInitialData> {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const search = url.searchParams.get("search") || "";
  const sort = url.searchParams.get("sort") || "latest";
  const category = url.searchParams.get("category") || "";

  const [posts, categories] = await Promise.all([
    getPosts({ page, pageSize: PER_PAGE, search, sort, category }),
    // 分类拉挂了只是筛选器空一栏，不该把整页拖成错误页
    getCategories().catch(() => []),
  ]);

  return {
    posts: posts.data,
    total: posts.total,
    page,
    search,
    sort,
    category,
    categories,
    pageSize: PER_PAGE,
  };
}
clientLoader.hydrate = true as const;

export function Component() {
  const initial = useLoaderData() as ForumInitialData;
  useSeo();
  return <ForumPage initial={initial} />;
}
