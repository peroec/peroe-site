import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("posts", "routes/posts._index.tsx"),
  route("posts/rss.xml", "routes/posts.rss[.]xml.tsx"),
  route("posts/:slug", "routes/posts.$slug.tsx"),
  route("forum", "routes/forum._index.tsx"),
  route("forum/post/:id", "routes/forum.post.$id.tsx"),
  route("forum/auth/login", "routes/forum.auth.login.tsx"),
  route("forum/auth/register", "routes/forum.auth.register.tsx"),
  route("forum/admin", "routes/forum.admin.tsx"),
  route("friends", "routes/friends.tsx"),
  route("sponsors", "routes/sponsors.tsx"),
  route("anime", "routes/anime.tsx"),
  route("cover", "routes/tools.cover.tsx"),
  route("watermark", "routes/tools.watermark.tsx"),
  route("convert", "routes/tools.convert.tsx"),
  route("bilibili-cover", "routes/tools.bilibili-cover.tsx"),
  route("agree", "routes/agree.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("*", "routes/catchall.tsx"),
] satisfies RouteConfig;
