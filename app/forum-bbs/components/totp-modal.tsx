'use client';

import { useRef, useState } from 'react';
import { Button } from '@/forum-bbs/components/ui/button';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (code: string) => Promise<void>;
  title?: string;
}

export function TotpModal({ open, onClose, onSubmit, title = '双重验证' }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputsRef = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null, null]);

  if (!open) return null;

  const handleInput = (idx: number, val: string) => {
    const digits = code.split('');
    digits[idx] = val.replace(/\D/g, '').slice(0, 1);
    const newCode = Array.from({ length: 6 }, (_, i) => digits[i] || '').join('');
    setCode(newCode);
    if (val && idx < 5) inputsRef.current[idx + 1]?.focus();
    if (newCode.length === 6) {
      submitCode(newCode);
    }
  };

  const submitCode = async (c?: string) => {
    const finalCode = c || code;
    if (finalCode.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await onSubmit(finalCode);
      setCode('');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '验证失败');
      setCode('');
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { if (!loading) { setCode(''); onClose(); }}}>
      <div className="bg-background border border-foreground/80 p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-4">请输入身份验证器应用中的 6 位动态码</p>

        {error && <p className="text-xs text-destructive mb-3">{error}</p>}

        <div className="flex justify-center gap-2 mb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              name="totp"
              maxLength={1}
              value={code[i] || ''}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !code[i] && i > 0) inputsRef.current[i - 1]?.focus();
              }}
              className="w-10 h-12 text-center text-lg font-mono rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { setCode(''); onClose(); }} disabled={loading}>取消</Button>
          <Button className="flex-1" onClick={() => submitCode()} disabled={loading || code.length !== 6}>
            {loading ? '验证中…' : '验证'}
          </Button>
        </div>
      </div>
    </div>
  );
}
