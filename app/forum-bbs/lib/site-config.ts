/**
 * 站点统一配置 —— 全站定制化的唯一入口。
 * 数据源：site.config.json（改这一个文件即可定制全站）。
 *
 * 部署前请修改 site.config.json：
 *  - url / ogImage：换成你的真实域名
 *  - name / title / description / avatar / slogan：你的站点信息
 */
import rawConfig from "../site.config.json";

export const siteConfig = rawConfig;

export type SiteConfig = typeof siteConfig;
