import { useCallback, useState } from "react";
import {
  ChevronRight,
  ArrowUp,
  Folder,
  FolderOpen,
  Download,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileText,
  FileCode,
  File,
  Box,
  HardDrive,
} from "lucide-react";
import { type FileItem, formatSize, getFileKind, type FileKind } from "~/lib/file-utils";

interface FileExplorerProps {
  items: FileItem[];
  baseUrl?: string;
}

function KindIcon({ kind }: { kind: FileKind }) {
  switch (kind) {
    case "image": return <FileImage className="size-5 shrink-0 text-muted-foreground" />;
    case "video": return <FileVideo className="size-5 shrink-0 text-muted-foreground" />;
    case "audio": return <FileAudio className="size-5 shrink-0 text-muted-foreground" />;
    case "archive": return <FileArchive className="size-5 shrink-0 text-muted-foreground" />;
    case "pdf": case "document": return <FileText className="size-5 shrink-0 text-muted-foreground" />;
    case "code": return <FileCode className="size-5 shrink-0 text-muted-foreground" />;
    case "app": return <Box className="size-5 shrink-0 text-muted-foreground" />;
    default: return <File className="size-5 shrink-0 text-muted-foreground" />;
  }
}

export function FileExplorer({ items, baseUrl = "" }: FileExplorerProps) {
  const [pathStack, setPathStack] = useState<{ name: string; items: FileItem[] }[]>([
    { name: "根目录", items },
  ]);

  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    if (pathStack.length !== 1 || pathStack[0].items !== items) {
      setPathStack([{ name: "根目录", items }]);
    }
  }

  const currentView = pathStack[pathStack.length - 1];

  const navigateInto = useCallback((item: FileItem) => {
    if (item.type === "directory" && item.children) {
      setPathStack((prev) => [...prev, { name: item.name, items: item.children ?? [] }]);
    }
  }, []);

  const navigateToLevel = useCallback((index: number) => {
    setPathStack((prev) => prev.slice(0, index + 1));
  }, []);

  const goBack = useCallback(() => {
    setPathStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  return (
    <div className="flex flex-col">
      {/* 面包屑 */}
      <div className="mb-4 flex items-center gap-1 overflow-x-auto whitespace-nowrap bg-muted p-2 text-sm">
        {pathStack.map((folder, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
            <button
              type="button"
              onClick={() => navigateToLevel(i)}
              className={`px-2 py-1 transition-colors hover:bg-foreground hover:text-background ${
                i === pathStack.length - 1 ? "font-bold text-primary" : "text-muted-foreground"
              }`}
            >
              {folder.name}
            </button>
          </span>
        ))}
      </div>

      {/* 表头 */}
      <div className="mb-1 flex items-center border-b px-0 sm:px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <span className="flex-1">名称</span>
        <span className="w-24 text-right">大小</span>
        <span className="w-12" />
      </div>

      <div className="divide-y divide-border/40">
        {/* 上一级 */}
        {pathStack.length > 1 && (
          <button
            type="button"
            onClick={goBack}
            className="group flex w-full items-center gap-2 px-0 sm:px-3 py-2 text-left transition-colors hover:bg-foreground hover:text-background"
          >
            <ArrowUp className="size-5 text-muted-foreground group-hover:text-background" />
            <span className="font-medium text-muted-foreground group-hover:text-background">
              ... (返回上一级)
            </span>
          </button>
        )}

        {currentView.items.map((item) =>
          item.type === "directory" ? (
            <button
              key={item.path}
              type="button"
              onClick={() => navigateInto(item)}
              className="group flex w-full items-center gap-2 px-0 sm:px-3 py-2 text-left transition-colors hover:bg-foreground hover:text-background"
            >
              <Folder className="size-5 text-primary transition-transform group-hover:scale-110 group-hover:text-background" />
              <span className="flex-1 font-medium">{item.name}</span>
              <ChevronRight className="size-5 text-muted-foreground group-hover:text-background" />
            </button>
          ) : (
            <a
              key={item.path}
              href={`${baseUrl}/${item.path.split("/").map(encodeURIComponent).join("/")}`}
              download={item.name}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between px-0 sm:px-3 py-2 no-underline transition-colors hover:bg-foreground hover:text-background"
            >
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <KindIcon kind={getFileKind(item.name)} />
                <span className="truncate text-muted-foreground group-hover:text-background">
                  {item.name}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground group-hover:text-background">
                <span className="w-24 text-right">{formatSize(item.size)}</span>
                <span
                  className="flex w-12 justify-center opacity-0 transition-opacity group-hover:opacity-100"
                  title="下载"
                >
                  <Download className="size-5" />
                </span>
              </div>
            </a>
          ),
        )}

        {currentView.items.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <FolderOpen className="mx-auto mb-2 size-10" />
            <p>文件夹为空</p>
          </div>
        )}
      </div>
    </div>
  );
}

export { HardDrive };
