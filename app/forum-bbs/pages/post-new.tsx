import Page from "@/forum-bbs/app/post/new/page";
import { useSeo } from "@/forum-bbs/lib/seo/use-seo";

export function Component() {
  useSeo();
  return <Page />;
}
