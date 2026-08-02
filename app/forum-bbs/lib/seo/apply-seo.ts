/**
 * 客户端 SEO 应用层：把 RouteMeta / 页面动态数据写入 <head>。
 *
 * 所有被管理的标签（title/description/canonical/OG/twitter/robots/JSON-LD）
 * 每次 applySeo 都会完整重写，保证路由切换后不残留上一页的值。
 * index.html 中已预置全部标签，这里只更新不创建（缺失时兜底创建）。
 */

import {
  SITE_URL,
  DEFAULT_OG_IMAGE,
  formatTitle,
  canonicalPath,
  breadcrumbJsonLd,
} from './route-meta';

export { makeExcerpt } from './route-meta';

export interface PageSeo {
  /** 页面标题（不含站名后缀）；空串表示使用整站标题 */
  title: string;
  description: string;
  /** canonical 路径（以 / 开头）；缺省用当前 location.pathname */
  path?: string;
  noindex?: boolean;
  ogType?: 'website' | 'article';
  /** 绝对或根相对 URL；缺省用整站默认分享图 */
  ogImage?: string;
  /** 结构化数据（如 BlogPosting）；不传则移除上一页注入的 JSON-LD */
  jsonLd?: Record<string, unknown> | null;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

const JSONLD_ID = 'page-jsonld';

export function applySeo(seo: PageSeo) {
  const fullTitle = formatTitle(seo.title);
  const url = SITE_URL + canonicalPath(seo.path ?? window.location.pathname);
  const ogImage = seo.ogImage ? new URL(seo.ogImage, SITE_URL).toString() : DEFAULT_OG_IMAGE;

  document.title = fullTitle;
  upsertMeta('name', 'description', seo.description);
  upsertMeta('name', 'robots', seo.noindex ? 'noindex' : 'index, follow');
  upsertLink('canonical', url);

  upsertMeta('property', 'og:title', fullTitle);
  upsertMeta('property', 'og:description', seo.description);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:type', seo.ogType ?? 'website');
  upsertMeta('property', 'og:image', ogImage);
  upsertMeta('name', 'twitter:title', fullTitle);
  upsertMeta('name', 'twitter:description', seo.description);
  upsertMeta('name', 'twitter:image', ogImage);

  // JSON-LD：可索引页自动附加 BreadcrumbList（富媒体面包屑），与页面级数据（如 BlogPosting）合并
  const blocks: Record<string, unknown>[] = [];
  if (!seo.noindex) {
    const bc = breadcrumbJsonLd(seo.path ?? window.location.pathname, seo.title);
    if (bc) blocks.push(bc);
  }
  if (seo.jsonLd) blocks.push(seo.jsonLd);

  const prev = document.getElementById(JSONLD_ID);
  if (blocks.length) {
    const script = prev ?? document.createElement('script');
    script.id = JSONLD_ID;
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify(blocks.length === 1 ? blocks[0] : blocks);
    if (!prev) document.head.appendChild(script);
  } else {
    prev?.remove();
  }
}
