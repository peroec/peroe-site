/** 站点信息唯一来源 */
export const SITE_NAME = "peroe";
export const SITE_AVATAR = "";
export const SITE_SLOGAN = "Protect What You Love.";
export const SITE_DESCRIPTION = "技术博客 · 社区论坛 · 实用在线工具集";
export const SITE_TITLE = "peroe 官方网站";

/** 门户主页地址（各子站返回的 home） */
export const HOME_URL = "https://hub.060730.xyz";

/** 论坛后端（SSR 回源，见 api.server.ts） */
export const FORUM_API_BASE_URL = "https://forum.060730.xyz";

/** 统计脚本（umami 等）：src 非空才注入 index.html；websiteId 为 data-website-id */
export const ANALYTICS = {
  src: "https://cloud.umami.is/script.js",
  websiteId: "842d980c-5e11-4834-a2a8-5daaa285ce66",
};

export const SOCIAL_LINKS = [
  { label: "爱发电", icon: "heart", url: "https://www.ifdian.net/a/acofork" },
  { label: "B站主页", icon: "video", url: "https://space.bilibili.com/325903362" },
  { label: "QQ群", icon: "message", url: "https://qm.qq.com/q/FWqOHlwL2m" },
  { label: "Telegram群", icon: "send", url: "https://t.me/+_07DERp7k1ljYTc1" },
  { label: "GitHub", icon: "github", url: "https://github.com/afoim" },
  { label: "Folo", icon: "rss", url: "https://app.folo.is/share/feeds/245004133358075904" },
];

/** 工具下拉（独立部署的 2xss_box 工具箱 + 站内工具页） */
export const TOOL_ITEMS = [
  { label: "封面制作", url: "/cover" },
  { label: "水印", url: "/watermark" },
  { label: "图片转换", url: "/convert" },
  { label: "B站封面", url: "/bilibili-cover" },
  { label: "Tier List", url: "/tier" },
  { label: "文件下载", url: "/files" },
];
