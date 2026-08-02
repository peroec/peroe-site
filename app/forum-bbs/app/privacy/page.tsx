export default function ForumPrivacyPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold mb-8">隐私政策</h1>
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>本站仅收集为你提供服务所必需的最少信息。</p>
        <p>1. 注册论坛账号时需要提供用户名与邮箱，用于登录与通知。</p>
        <p>2. 本站使用 Cookie / localStorage 保存登录状态与偏好设置。</p>
        <p>3. 我们不会将你的个人信息出售或分享给第三方。</p>
        <p>4. 如需删除账号与相关数据，请在个人中心操作或联系站长。</p>
      </div>
    </main>
  );
}
