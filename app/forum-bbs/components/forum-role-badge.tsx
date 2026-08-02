/**
 * 用户名旁的角色标识。
 *
 * 论坛允许重名注册 —— 光看用户名分不出「AcoFork(我爱重构)」本人和顶着同名
 * 头像的仿冒者。角色由后端随数据一起下发（评论是 `role`、帖子是 `author_role`，
 * 两者都在 map-comment / map-post 里映射成 `author.role`），前端只负责显示。
 * 仿冒者改不了自己的 role，也没法把这个标签塞进用户名里 —— 用户名是纯文本
 * 渲染，带边框的 `管理员` / `机器人` 只可能来自这个组件。
 *
 * 有意做成纯文字而非图标：图标容易被忽略，也容易被仿冒者拿 emoji 放进昵称里
 * 模仿；带边框的 mono 文字在昵称文本流里做不出来。
 *
 * 权限完全不看这里 —— 前后端所有鉴权都是 `role === 'admin'` 的等值判断，
 * 新增 `bot` 这类值等同普通用户，不会带来任何额外权限。
 */
const ROLE_LABELS: Record<string, { label: string; title: string; className: string }> = {
  admin: {
    label: '管理员',
    title: '站点管理员 —— 由服务端标记，无法伪造',
    className: 'border-foreground/70 text-foreground',
  },
  bot: {
    label: '机器人',
    title: '自动化账号 —— 由服务端标记，无法伪造',
    className: 'border-muted-foreground/60 text-muted-foreground',
  },
};

export function RoleBadge({ role }: { role?: string | null }) {
  const meta = role ? ROLE_LABELS[role] : undefined;
  if (!meta) return null;
  return (
    <span
      className={`shrink-0 border px-1 py-px font-mono text-[10px] leading-none ${meta.className}`}
      title={meta.title}
    >
      {meta.label}
    </span>
  );
}
