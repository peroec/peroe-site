/**
 * 站点统一配置 —— 唯一来源：app/lib/site.config.json（部署时只改这一个文件）。
 * 见 docs/deploy-config.md 的说明。
 */
import rawConfig from "./site.config.json";

export interface SocialLink {
  label: string;
  icon: string;
  url: string;
}

export const SITE_NAME: string = rawConfig.siteName;
export const SITE_AVATAR: string = rawConfig.siteAvatar;
export const SITE_SLOGAN: string = rawConfig.siteSlogan;
export const SITE_DESCRIPTION: string = rawConfig.siteDescription;
export const SITE_TITLE: string = rawConfig.siteTitle;

/** 门户主页地址（各子站返回的 home） */
export const HOME_URL: string = rawConfig.homeUrl;

/** 论坛后端（SSR 回源） */
export const FORUM_API_BASE_URL: string = rawConfig.forumApiBase;

/** 论坛独立部署地址（SEO canonical 用） */
export const FORUM_SITE_URL: string = rawConfig.forumSiteUrl;

/** 工具箱文件索引服务 */
export const FILES_BASE_URL: string = rawConfig.filesBaseUrl;

/** 友链/赞助数据服务（af_friends-data 部署的静态 JSON） */
export const FAS_ORIGIN: string = rawConfig.fasOrigin;

/** 友链数据仓库地址（申请友链指向） */
export const FAS_REPO: string = rawConfig.fasRepo;

/** 统计脚本（umami 等）：src 非空才注入 index.html；websiteId 为 data-website-id */
export const ANALYTICS: { src: string; websiteId: string } = rawConfig.analytics;

/** umami 分享配置（浏览量回显）：shareToken 非空才启用客户端浏览量查询 */
export const UMAMI_SHARE: { shareToken: string; region: string } = rawConfig.analytics;

export const SOCIAL_LINKS: SocialLink[] = rawConfig.socialLinks;

/** 工具下拉（独立部署的 2xss_box 工具箱 + 站内工具页） */
export const TOOL_ITEMS = [
  { label: "封面制作", url: "/cover" },
  { label: "水印", url: "/watermark" },
  { label: "图片转换", url: "/convert" },
  { label: "B站封面", url: "/bilibili-cover" },
  { label: "Tier List", url: "/tier" },
  { label: "文件下载", url: "/files" },
];
