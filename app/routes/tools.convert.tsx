import { useState } from "react";
import type { Route } from "./+types/tools.convert";
import { Image as ImageIcon } from "lucide-react";

export function meta() {
  return [
    { title: "图片格式转换工具 | peroe" },
    { name: "description", content: "在线转换图片格式（PNG / JPEG / WebP）" },
  ];
}

const FORMATS = [
  { key: "image/png", ext: "png", label: "PNG" },
  { key: "image/jpeg", ext: "jpg", label: "JPEG" },
  { key: "image/webp", ext: "webp", label: "WebP" },
];

export default function ConvertTool(_props: Route.ComponentProps) {
  const [source, setSource] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<{ w: number; h: number } | null>(null);
  const [format, setFormat] = useState("image/png");
  const [quality, setQuality] = useState(0.9);
  const [fileName, setFileName] = useState("image");

  const readFile = (file: File | undefined) => {
    if (!file) return;
    // #183：换图时清空旧预览，避免旧结果与新设置并存误导
    setPreview(null);
    setResultSize(null);
    setFileName(file.name.replace(/\.[^.]+$/, "") || "image");
    const reader = new FileReader();
    reader.onload = () => setSource(String(reader.result));
    reader.readAsDataURL(file);
  };

  // #183：补齐"拖拽上传"（文案承诺了但此前没有实现）
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    readFile(e.dataTransfer.files?.[0]);
  };

  const convert = () => {
    if (!source) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // JPEG 无透明，垫白底
      if (format === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      const mime = format;
      const q = mime === "image/png" ? undefined : quality;
      const dataUrl = canvas.toDataURL(mime, q);
      setPreview(dataUrl);
      setResultSize({ w: canvas.width, h: canvas.height });
    };
    img.src = source;
  };

  const download = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    const ext = FORMATS.find((f) => f.key === format)?.ext || "png";
    a.download = `${fileName || "image"}.${ext}`;
    a.click();
  };

  const ext = FORMATS.find((f) => f.key === format)?.ext || "png";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white">图片转换</h1>
      <p className="mb-8 mt-2 text-sm text-muted">在线转换图片格式，全部在本地完成，不上传服务器</p>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1 space-y-4">
          {source ? (
            <div className="overflow-hidden rounded-lg border border-border bg-background">
              <img src={source} alt="原图" className="block max-w-full" />
            </div>
          ) : (
            <label
              className="flex h-64 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted transition-colors hover:border-neutral-500 hover:text-white"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <ImageIcon className="mb-2 h-8 w-8" aria-hidden="true" />
              点击或拖拽上传图片
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => readFile(e.target.files?.[0])}
              />
            </label>
          )}

          {preview && (
            <div className="overflow-hidden rounded-lg border border-border bg-background">
              <img src={preview} alt="转换结果" className="block max-w-full" />
              {resultSize && (
                <p className="border-t border-border bg-card px-3 py-2 text-xs text-muted-2">
                  转换结果：{resultSize.w}x{resultSize.h} px · .{ext}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="w-full space-y-6 lg:w-72">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">转换设置</h2>
            <div className="space-y-4 text-xs text-muted">
              <div>
                <span className="mb-1.5 block">目标格式</span>
                <div className="flex gap-1.5">
                  {FORMATS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFormat(f.key)}
                      className={`flex-1 rounded border py-1.5 text-xs transition-colors ${
                        format === f.key
                          ? "border-white bg-white font-medium text-black"
                          : "border-border text-muted hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {format !== "image/png" && (
                <div className="flex items-center justify-between">
                  <span>质量: {Math.round(quality * 100)}%</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-32 accent-white"
                  />
                </div>
              )}
              <label className="block">
                <span className="mb-1 block">文件名</span>
                <input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-neutral-500 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={convert}
                disabled={!source}
                className="w-full rounded bg-white py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
              >
                开始转换
              </button>
              <button
                type="button"
                onClick={download}
                disabled={!preview}
                className="w-full rounded border border-border py-2 text-sm text-muted transition-colors hover:text-white disabled:opacity-40"
              >
                下载 .{ext}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
