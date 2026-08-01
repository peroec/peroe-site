export function meta() {
  return [{ title: "用户协议 | 二叉树树" }];
}

export default function Agree() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="mb-8 text-2xl font-bold text-white">用户协议</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted">
        <p>欢迎使用本站。继续使用本网站即表示你同意本协议中所述条款。</p>
        <p>1. 本站内容为个人创作与分享，仅供参考，不构成任何专业建议。</p>
        <p>2. 在论坛发布内容时，请遵守法律法规，不得发布违法、侵权、垃圾信息。</p>
        <p>3. 本站保留对违规内容与账号的处理权利。</p>
        <p>4. 本协议可能随时更新，更新后立即生效。</p>
      </div>
    </main>
  );
}
