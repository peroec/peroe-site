import { useParams } from "react-router";
import { NovelDetail } from "@/components/webnovel/detail";

export function meta() {
  return [{ title: "交互小说 | peroe" }];
}

export default function WebnovelDetailPage() {
  const { slug } = useParams();
  return <NovelDetail slug={slug || ""} />;
}
