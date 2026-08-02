import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from '@/forum-bbs/components/ui/button';
import { Input } from '@/forum-bbs/components/ui/input';
import { Alert } from '@/forum-bbs/components/ui/alert';
import { register } from '@/forum-bbs/lib/forum/api/client';

export default function ForumRegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) { setError('请填写所有字段'); return; }
    setLoading(true);
    setError('');
    try {
      await register({ username, email: email.toLowerCase(), password });
      // 注册后统一跳登录页并提示查收激活邮件
      navigate('/forum/auth/login?registered=1');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold text-center mb-6">注册</h1>
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" />
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" />
        <Button type="submit" disabled={loading} className="w-full">{loading ? '注册中…' : '注册'}</Button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-4">
        <Link to="/forum/auth/login" className="hover:text-foreground">已有账号？去登录</Link>
      </p>
    </main>
  );
}
