import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import type { Route } from "./+types/tools.files";
import { FileExplorer } from "~/components/FileExplorer";
import type { FileItem } from "~/lib/file-utils";
import { FILES_BASE_URL } from "~/lib/site";

export function meta() {
  return [
    { title: "文件下载 | peroe" },
    { name: "description", content: "文件索引与下载" },
  ];
}

const FILES_INDEX_URL = `${FILES_BASE_URL}/index.json`;

export default function FilesPage() {
  const [fileTree, setFileTree] = useState<FileItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(FILES_INDEX_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<FileItem[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setFileTree(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <HardDrive className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold text-white">文件下载</h1>
      </div>

      {loading && (
        <p className="py-16 text-center text-sm text-muted-2">正在加载文件索引…</p>
      )}
      {error && (
        <p className="py-16 text-center text-sm text-muted-2">
          加载失败：{error}（文件服务暂不可用）
        </p>
      )}
      {!loading && !error && fileTree && (
        <FileExplorer items={fileTree} baseUrl={FILES_BASE_URL} />
      )}
    </main>
  );
}
