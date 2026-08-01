import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Cookie, Check, Settings } from "lucide-react";

const STORAGE_KEY = "cookie-consent";

/**
 * Cookie 同意横幅（复刻线上样式）。
 * 勾选「我已阅读并同意」后才能点击按钮；选择后写入 localStorage 不再显示。
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = (choice: string) => {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-5 shadow-2xl">
        <p className="mb-2 flex items-center gap-2 font-semibold text-white">
          <Cookie className="h-4 w-4" /> 隐私与协议
        </p>
        <p className="text-sm text-muted">
          继续使用本网站即表示你同意以下协议及隐私政策中所述的 Cookie 使用方式。
        </p>
        <p className="mt-2 text-sm text-muted">
          点击"接受全部"即表示您同意我们使用所有 Cookie，您也可以点击"自定义设置"来选择您希望启用的
          Cookie 类型。
        </p>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="h-4 w-4 accent-white"
          />
          <span>
            我已阅读并同意
            <Link to="/agree" className="mx-1 text-white underline">
              《用户协议》
            </Link>
            和
            <Link to="/privacy" className="mx-1 text-white underline">
              《隐私政策》
            </Link>
          </span>
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!agreed}
            onClick={() => dismiss("all")}
            className="flex items-center gap-1.5 rounded bg-white px-4 py-2 text-sm font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> 接受全部
          </button>
          <button
            type="button"
            disabled={!agreed}
            onClick={() => dismiss("necessary")}
            className="rounded border border-border px-4 py-2 text-sm text-muted transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            仅必要 Cookie
          </button>
          <button
            type="button"
            disabled={!agreed}
            onClick={() => dismiss("custom")}
            className="flex items-center gap-1.5 rounded border border-border px-4 py-2 text-sm text-muted transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Settings className="h-4 w-4" /> 自定义设置
          </button>
        </div>
      </div>
    </div>
  );
}
