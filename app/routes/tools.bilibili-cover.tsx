import { useState } from "react";
import type { Route } from "./+types/tools.bilibili-cover";
import { Download, Loader2, Search, Tv } from "lucide-react";

export function meta() {
  return [
    { title: "B站封面下载工具 | peroe" },
    { name: "description", content: "输入 B 站视频链接或 BV 号，一键下载视频封面" },
  ];
}

interface BiliData {
  title: string;
  pic: string;
  owner?: { name: string };
  stat?: { view: number };
}

export default function BiliCoverTool(_props: Route.ComponentProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<BiliData | null>(null);

  const parseId = (raw: string): { bvid?: string; avid?: number } => {
    const s = raw.trim();
    const bv = s.match(/BV[0-9A-Za-z]{10}/);
    if (bv) return { bvid: bv[0] };
    const av = s.match(/(?:av|AV)(\d+)/);
    if (av) return { avid: Number(av[1]) };
    const urlAv = s.match(/video\/(?:av|AV)(\d+)/);
    if (urlAv) return { avid: Number(urlAv[1]) };
    const urlBv = s.match(/video\/(BV[0-9A-Za-z]{10})/);
    if (urlBv) return { bvid: urlBv[1] };
    return {};
  };

  const search = async () => {
    setError("");
    setData(null);
    const { bvid, avid } = parseId(input);
    if (!bvid && !avid) {
      setError("请输入有效的 BV 号 / av 号 / 视频链接");
      return;
    }
    setLoading(true);
    try {
      const qs = bvid ? `bvid=${bvid}` : `aid=${avid}`;
      const res = await fetch(`https://api.bilibili.com/x/web-interface/view?${qs}`);
      const json = (await res.json()) as {
        code: number;
        message: string;
        data?: BiliData;
      };
      if (json.code !== 0 || !json.data) {
        throw new Error(json.message || "获取失败");
      }
      setData(json.data);
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("fetch")
          ? "请求失败：B站接口不允许跨域访问，请稍后再试或使用浏览器扩展下载封面"
          : e instanceof Error
            ? e.message
            : "获取失败"
      );
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!data) return;
    const a = document.createElement("a");
    a.href = data.pic;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white">B站封面下载</h1>
      <p className="mb-8 mt-2 text-sm text-muted">输入 B 站视频链接或 BV 号，一键下载视频封面</p>

      <div className="mb-8 flex gap-2">
        <div className="relative flex-1">
          <Tv className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="粘贴 BV 号 / av 号 / 视频链接，例如 BV1GJ411x7h7"
            className="w-full rounded border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-2 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="flex items-center gap-1.5 rounded bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          获取封面
        </button>
      </div>

      {error && (
        <p className="mb-6 rounded border border-border bg-card p-4 text-sm text-accent">{error}</p>
      )}

      {data && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <img src={data.pic} alt={data.title} className="aspect-video w-full object-cover" />
          <div className="p-4">
            <h2 className="mb-2 text-sm font-semibold leading-snug text-white">{data.title}</h2>
            {data.owner && (
              <p className="mb-4 text-xs text-muted-2">UP主：{data.owner.name}</p>
            )}
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-1.5 rounded bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
            >
              <Download className="h-4 w-4" /> 下载封面
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
