/**
 * Cookie 同意管理 —— 统计脚本（umami）与第三方组件（Giscus）按用户选择门控。
 * 选择值：all（接受全部）/ necessary（仅必要）/ custom（自定义，默认等同 necessary）
 */
const STORAGE_KEY = "cookie-consent";

export type CookieChoice = "all" | "necessary" | "custom";

export function getCookieChoice(): CookieChoice | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "all" || v === "necessary" || v === "custom" ? v : null;
  } catch {
    return null;
  }
}

/** 统计脚本是否允许加载（仅「接受全部」放行） */
export function allowAnalytics(): boolean {
  return getCookieChoice() === "all";
}

/** 第三方评论（Giscus）是否允许加载（「接受全部」或「自定义」放行） */
export function allowThirdParty(): boolean {
  const c = getCookieChoice();
  return c === "all" || c === "custom";
}
