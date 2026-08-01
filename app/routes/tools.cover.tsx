import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/tools.cover";

export function meta() {
  return [
    { title: "视频封面制作工具 | 二叉树树" },
    { name: "description", content: "在线生成精美的封面图片" },
  ];
}

const RATIOS: Record<string, { label: string; w: number; h: number }> = {
  "1:1": { label: "1:1", w: 600, h: 600 },
  "4:3": { label: "4:3", w: 800, h: 600 },
  "16:9": { label: "16:9", w: 1067, h: 600 },
  "21:9": { label: "21:9", w: 1400, h: 600 },
};

interface Settings {
  leftText: string;
  rightText: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  bgColor: string;
  showIcon: boolean;
  iconColor: string;
  ratio: string;
  scale: number;
  fileName: string;
}

const DEFAULT_SETTINGS: Settings = {
  leftText: "示例",
  rightText: "文本",
  fontSize: 64,
  fontWeight: 400,
  textColor: "#000000",
  bgColor: "#ffffff",
  showIcon: true,
  iconColor: "#000000",
  ratio: "16:9",
  scale: 1,
  fileName: "cover",
};

export default function CoverTool(_props: Route.ComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [icon, setIcon] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  // 画布绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = RATIOS[settings.ratio];
    canvas.width = ratio.w * settings.scale;
    canvas.height = ratio.h * settings.scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(settings.scale, settings.scale);

    // 背景
    ctx.fillStyle = settings.bgColor;
    ctx.fillRect(0, 0, ratio.w, ratio.h);

    // 背景图（cover 填充）
    if (bgImage) {
      const img = new Image();
      img.onload = () => {
        drawContent(ctx, ratio.w, ratio.h, img);
      };
      img.src = bgImage;
      return;
    }
    drawContent(ctx, ratio.w, ratio.h, null);
  }, [settings, icon, bgImage]);

  function drawContent(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bg: HTMLImageElement | null
  ) {
    if (bg) {
      const scale = Math.max(w / bg.width, h / bg.height);
      const dw = bg.width * scale;
      const dh = bg.height * scale;
      ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    const iconSize = settings.fontSize * 1.15;
    const gap = settings.fontSize * 0.45;
    // 图标（左侧）
    let x = gap;
    if (settings.showIcon && icon) {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(iconSize / img.width, iconSize / img.height);
        const dw = img.width * r;
        const dh = img.height * r;
        ctx.drawImage(img, gap, (h - dh) / 2, dw, dh);
        drawTexts(ctx, w, h, gap + iconSize + gap);
      };
      img.src = icon;
    } else {
      drawTexts(ctx, w, h, x);
    }
  }

  function drawTexts(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    startX: number
  ) {
    ctx.textBaseline = "middle";
    ctx.fillStyle = settings.textColor;
    // 左侧文字
    ctx.textAlign = "left";
    ctx.font = `${settings.fontWeight} ${settings.fontSize}px sans-serif`;
    ctx.fillText(settings.leftText, startX, h / 2);
    // 右侧文字
    ctx.textAlign = "right";
    ctx.fillText(settings.rightText, w - startX, h / 2);
  }

  // 导出
  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${settings.fileName || "cover"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const readFile = (file: File | undefined, cb: (dataUrl: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result));
    reader.readAsDataURL(file);
  };

  const { w, h } = RATIOS[settings.ratio];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white">封面制作</h1>
      <p className="mb-8 mt-2 text-sm text-muted">在线生成精美的封面图片</p>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* 预览画布 */}
        <div className="flex-1">
          <div className="relative overflow-hidden rounded-lg border border-border bg-background">
            <canvas ref={canvasRef} className="block w-full" />
            <span className="absolute right-3 top-3 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
              {settings.ratio} · {w}x{h}
            </span>
          </div>
        </div>

        {/* 设置面板 */}
        <div className="w-full space-y-6 lg:w-80">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">内容</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">左侧文字</span>
                <input
                  value={settings.leftText}
                  onChange={(e) => set("leftText", e.target.value)}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-neutral-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">右侧文字</span>
                <input
                  value={settings.rightText}
                  onChange={(e) => set("rightText", e.target.value)}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-neutral-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">
                  字体粗细: {settings.fontWeight}
                </span>
                <input
                  type="range"
                  min={100}
                  max={900}
                  step={100}
                  value={settings.fontWeight}
                  onChange={(e) => set("fontWeight", Number(e.target.value))}
                  className="w-full accent-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">
                  字体大小: {settings.fontSize}px
                </span>
                <input
                  type="range"
                  min={20}
                  max={200}
                  value={settings.fontSize}
                  onChange={(e) => set("fontSize", Number(e.target.value))}
                  className="w-full accent-white"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={settings.showIcon}
                  onChange={(e) => set("showIcon", e.target.checked)}
                  className="h-4 w-4 accent-white"
                />
                显示图标
              </label>
              {settings.showIcon && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">上传图标</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      readFile(e.target.files?.[0], (d) => setIcon(d))
                    }
                    className="text-xs text-muted file:mr-2 file:rounded file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs file:text-muted"
                  />
                  {icon && (
                    <button
                      type="button"
                      onClick={() => setIcon(null)}
                      className="text-xs text-accent"
                    >
                      移除
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">样式</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-xs text-muted">
                文字颜色
                <input
                  type="color"
                  value={settings.textColor}
                  onChange={(e) => set("textColor", e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border border-border bg-background"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-muted">
                背景颜色
                <input
                  type="color"
                  value={settings.bgColor}
                  onChange={(e) => set("bgColor", e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border border-border bg-background"
                />
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">背景图片</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    readFile(e.target.files?.[0], (d) => setBgImage(d))
                  }
                  className="text-xs text-muted file:mr-2 file:rounded file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs file:text-muted"
                />
                {bgImage && (
                  <button
                    type="button"
                    onClick={() => setBgImage(null)}
                    className="text-xs text-accent"
                  >
                    移除
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">导出</h2>
            <div className="space-y-3">
              <div>
                <span className="mb-1.5 block text-xs text-muted">画板比例</span>
                <div className="flex gap-1.5">
                  {Object.keys(RATIOS).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => set("ratio", r)}
                      className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                        settings.ratio === r
                          ? "border-white bg-white font-medium text-black"
                          : "border-border text-muted hover:text-white"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1.5 block text-xs text-muted">缩放倍率</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set("scale", s)}
                      className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                        settings.scale === s
                          ? "border-white bg-white font-medium text-black"
                          : "border-border text-muted hover:text-white"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-2">
                  {w * settings.scale}x{h * settings.scale} px
                </p>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">文件名</span>
                <input
                  value={settings.fileName}
                  onChange={(e) => set("fileName", e.target.value)}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-neutral-500 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={exportPng}
                className="w-full rounded bg-white py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
              >
                导出 PNG
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
