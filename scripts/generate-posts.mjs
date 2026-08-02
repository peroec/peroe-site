/**
 * 构建前生成博客数据 —— 读取 content/*.mdx（PagesCMS 管理），
 * 内联生成 app/lib/generated-posts.ts，供 SSR 在 Workers/EdgeOne 无文件系统环境使用。
 *
 * 用法：node scripts/generate-posts.mjs（已接入 package.json 的 build 脚本）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, "../content");
const OUT_FILE = path.resolve(__dirname, "../app/lib/generated-posts.ts");

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim().replace(/^"|"$/g, "");
    if (key === "tags") {
      const tags = [];
      for (let j = i; j < lines.length; j++) {
        const tm = lines[j].match(/^\s*-\s*(.+)/);
        if (tm) tags.push(tm[1].trim());
      }
      value = tags;
    } else if (value === "true") value = true;
    else if (value === "false") value = false;
    meta[key] = value;
  }
  return { meta, body: raw.slice(m[0].length) };
}

const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx")).sort();
const posts = [];

for (const f of files) {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, f), "utf8");
  const { meta, body } = parseFrontmatter(raw);
  if (meta.draft === true) continue;
  posts.push({
    slug: f.replace(/\.mdx$/, ""),
    title: String(meta.title || f),
    description: String(meta.description || ""),
    coverImage: String(meta.coverImage || meta.thumbnail || ""),
    date: String(meta.date || "2026-01-01").slice(0, 10),
    pin: meta.pin === true || meta.pin === "true" ? 1 : 0,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    content: body,
  });
}

const ts = `/**
 * 自动生成 —— 勿手改。来源：content/*.mdx（PagesCMS 管理）。
 * 重新生成：node scripts/generate-posts.mjs
 */
export interface GeneratedPost {
  slug: string;
  title: string;
  description: string;
  coverImage: string;
  date: string;
  pin: number;
  tags: string[];
  content: string;
}

export const generatedPosts: GeneratedPost[] = ${JSON.stringify(posts, null, 2)};
`;

fs.writeFileSync(OUT_FILE, ts, "utf8");
console.log(`[generate-posts] ${posts.length} 篇文章已生成 → app/lib/generated-posts.ts`);
