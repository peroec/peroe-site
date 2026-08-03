/**
 * 代码块语言图标（博客侧）—— 与论坛 render-markdown.ts 同一套子集与映射。
 * subset.json 由 2xss_bbs/scripts/build-icon-subset.mjs 构建（扫描源码图标名），
 * 新增语言图标时：在 LANG_ICONS 加字面量 → 重跑构建脚本 → 同步 subset.json。
 */
import iconSubset from "~/forum-bbs/lib/icons/subset.json";

const LANG_ICONS: Record<string, string> = {
  bash: "mdi:console-line",
  sh: "mdi:console-line",
  shell: "mdi:console-line",
  zsh: "mdi:console-line",
  console: "mdi:console-line",
  powershell: "simple-icons:powershell",
  ps1: "simple-icons:powershell",
  javascript: "simple-icons:javascript",
  js: "simple-icons:javascript",
  jsx: "simple-icons:javascript",
  typescript: "simple-icons:typescript",
  ts: "simple-icons:typescript",
  tsx: "simple-icons:typescript",
  python: "simple-icons:python",
  py: "simple-icons:python",
  json: "mdi:code-json",
  yaml: "simple-icons:yaml",
  yml: "simple-icons:yaml",
  xml: "mdi:xml",
  html: "mdi:xml",
  css: "mdi:language-css3",
  php: "simple-icons:php",
  go: "simple-icons:go",
  golang: "simple-icons:go",
  sql: "mdi:database",
  dockerfile: "simple-icons:docker",
  docker: "simple-icons:docker",
  ini: "mdi:cog-outline",
  conf: "mdi:cog-outline",
  toml: "mdi:cog-outline",
  nginx: "simple-icons:nginx",
  markdown: "mdi:language-markdown",
  md: "mdi:language-markdown",
};

/** 没声明语言、或声明了但不在上表里时的通用图标 */
const FALLBACK_LANG_ICON = "mdi:code-tags";

type IconEntry = { body?: string; width?: number; height?: number; left?: number; top?: number };
type IconCollection = { icons: Record<string, IconEntry>; width?: number; height?: number };

/** 查子集表出一段 <svg> 字符串。表里没有就返回空串 —— 图标没了但文字还在，不至于崩 */
export function langIconSvg(lang: string, className: string): string {
  const name = LANG_ICONS[lang] ?? FALLBACK_LANG_ICON;
  const [prefix, id] = name.split(":");
  const collection = (iconSubset as Record<string, IconCollection>)[prefix];
  const data = collection?.icons?.[id];
  if (!data?.body) return "";
  const w = data.width ?? collection.width ?? 24;
  const h = data.height ?? collection.height ?? 24;
  const l = data.left ?? 0;
  const t = data.top ?? 0;
  return (
    `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${l} ${t} ${w} ${h}" aria-hidden="true">${data.body}</svg>`
  );
}
