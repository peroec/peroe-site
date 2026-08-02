import Page from "@/forum-bbs/app/auth/login/page";
import { useSeo } from "@/forum-bbs/lib/seo/use-seo";

export function Component() {
  useSeo();
  return <Page />;
}
