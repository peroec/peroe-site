import { useRef, useState } from "react";
import type { Route } from "./+types/tools.watermark";

export function meta() {
  return [
    { title: "图片加水印工具 | peroe" },
    { name: "description", content: "在线为图片添加文字或图片水印" },
  ];
}

const POSITIONS = [
  { key: "lt", label: "左上" },
  { key: "ct", label: "上中" },
  { key: "rt", label: "右上" },
  { key: "lm", label: "左中" },
  { key: "cc", label: "居中" },
  { key: "rm", label: "右中" },
  { key: "lb", label: "左下" },
  { key: "cb", label: "下中" },
  { key: "rb", label: "右下" },
];

export default function WatermarkTool(_props: Route.ComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(32);
  const [opacity, setOpacity] = useState(0.5);
  const [color, setColor] = useState("#ffffff");
  const [position, setPosition] = useState("rb");
  const [imgWatermark, setImgWatermark] = useState<string | null>(null);
  const [fileName, setFileName] = useState("watermarked");

  const readFile = (file: File | undefined, cb: (dataUrl: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result));
    reader.readAsDataURL(file);
  };

  const loadSource = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      setSource(dataUrl);
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = dataUrl;
  };

  const applyWatermark = () => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0);
      ctx.globalAlpha = opacity;

      const pad = 24;
      const getPos = () => {
        const col = position[0];
        const row = position[1];
        let x = pad;
        if (col === "c") x = w / 2;
        if (col === "r") x = w - pad;
        let y = pad;
        if (row === "c") y = h / 2;
        if (row === "b") y = h - pad;
        return { x, y };
      };

      if (imgWatermark) {
        const wm = new Image();
        wm.onload = () => {
          const size = Math.max(80, Math.min(w, h) * 0.25);
          const r = size / wm.naturalWidth;
          const dw = wm.naturalWidth * r;
          const dh = wm.naturalHeight * r;
          const { x, y } = getPos();
          ctx.drawImage(wm, x - dw / 2, y - dh / 2, dw, dh);
        };
        wm.src = imgWatermark;
      } else if (text.trim()) {
        ctx.fillStyle = color;
        ctx.font = `600 ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const { x, y } = getPos();
        ctx.fillText(text, x, y);
      }
      ctx.globalAlpha = 1;
    };
    img.src = source;
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName || "watermarked"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white">水印</h1>
      <p className="mb-8 mt-2 text-sm text-muted">在线为图片添加文字或图片水印</p>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1">
          {source ? (
            <div className="overflow-hidden rounded-lg border border-border bg-background">
              <canvas ref={canvasRef} className="block max-w-full" />
            </div>
          ) : (
            <label className="flex h-72 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted transition-colors hover:border-neutral-500 hover:text-white">
              <span className="mb-2 text-3xl">🖼️</span>
              点击或拖拽上传图片
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => readFile(e.target.files?.[0], loadSource)}
              />
            </label>
          )}
        </div>

        <div className="w-full space-y-6 lg:w-72">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">水印设置</h2>
            <div className="space-y-3 text-xs text-muted">
              <label className="block">
                <span className="mb-1 block">水印文字</span>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="输入水印文字"
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-2 focus:border-neutral-500 focus:outline-none"
                />
              </label>
              <div className="flex items-center justify-between">
                <span>文字大小: {fontSize}px</span>
                <input
                  type="range"
                  min={12}
                  max={120}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-32 accent-white"
                />
              </div>
              <div className="flex items-center justify-between">
                <span>不透明度: {Math.round(opacity * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-32 accent-white"
                />
              </div>
              <label className="flex items-center justify-between">
                <span>文字颜色</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border border-border bg-background"
                />
              </label>
              <div className="flex items-center gap-2">
                <span className="shrink-0">图片水印</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    readFile(e.target.files?.[0], (d) => setImgWatermark(d))
                  }
                  className="min-w-0 text-xs text-muted file:mr-2 file:rounded file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs file:text-muted"
                />
              </div>
              {imgWatermark && (
                <button
                  type="button"
                  onClick={() => setImgWatermark(null)}
                  className="text-accent"
                >
                  移除图片水印
                </button>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">位置</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {POSITIONS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPosition(p.key)}
                  className={`rounded border py-1.5 text-xs transition-colors ${
                    position === p.key
                      ? "border-white bg-white font-medium text-black"
                      : "border-border text-muted hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">导出</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">文件名</span>
                <input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-neutral-500 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={applyWatermark}
                disabled={!source || (!text.trim() && !imgWatermark)}
                className="w-full rounded bg-white py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
              >
                生成水印
              </button>
              <button
                type="button"
                onClick={exportPng}
                className="w-full rounded border border-border py-2 text-sm text-muted transition-colors hover:text-white"
              >
                导出图片
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
