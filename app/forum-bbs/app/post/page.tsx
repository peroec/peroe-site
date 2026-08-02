import { PostContent, type PostInitialData } from './post-content';

/**
 * 这里**不要**包 Suspense。数据由 loader 提供，没有任何东西会挂起，但 React 的
 * 流式 SSR 仍会为边界生成占位（`<!--$?-->` + `<template id="B:0">`），把正文
 * 甩到响应末尾的 `<div hidden id="S:0">` 里，靠内联 `$RC()` 脚本搬回原位 ——
 * 结果就是**禁用 JS 时整页空白**。去掉边界后正文直接落在 SSR shell 中。
 */
export default function ForumPostPage({
  initial,
  embedded,
}: {
  initial?: PostInitialData;
  /** 被路由层的 flex sidebar 布局包裹时，不渲染外层 <main> 容器 */
  embedded?: boolean;
} = {}) {
  return <PostContent initial={initial} embedded={embedded} />;
}
