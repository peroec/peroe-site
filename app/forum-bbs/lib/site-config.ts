/**
 * 论坛站点配置 —— 数据源：主站统一配置 app/lib/site.config.json
 * （forum-bbs 缝入大前端后不再维护独立配置，部署只改主站那一份）。
 */
import rawConfig from "@/lib/site.config.json";

export const siteConfig = {
  name: rawConfig.siteName,
  title: `${rawConfig.siteName} 论坛`,
  description: `${rawConfig.siteName} 论坛：技术交流与闲聊灌水社区，支持 Markdown 发帖、评论与点赞，欢迎注册加入讨论。`,
  slogan: rawConfig.siteSlogan,
  avatar: rawConfig.siteAvatar,
  url: rawConfig.forumSiteUrl,
  ogImage: "",
  keywords: [rawConfig.siteName, "论坛", "社区"],
  analytics: rawConfig.analytics,
  authAllowedOrigins: rawConfig.authAllowedOrigins,
};

export type SiteConfig = typeof siteConfig;
