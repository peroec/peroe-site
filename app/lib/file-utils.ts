/** 文件索引工具（复用自 2xss_box） */

export interface FileItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  mtime?: string;
  children?: FileItem[];
  downloadUrl?: string;
}

export function formatSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export type FileKind =
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "pdf"
  | "code"
  | "document"
  | "app"
  | "folder"
  | "file";

export function getFileKind(filename: string): FileKind {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg": case "jpeg": case "png": case "gif": case "svg":
    case "webp": case "avif": case "ico": case "bmp":
      return "image";
    case "mp4": case "webm": case "mkv": case "mov": case "avi":
    case "flv": case "ts":
      return "video";
    case "mp3": case "wav": case "flac": case "ogg": case "m4a":
      return "audio";
    case "zip": case "rar": case "7z": case "tar": case "gz":
    case "zpaq": case "zst":
      return "archive";
    case "pdf":
      return "pdf";
    case "js": case "ts": case "html": case "css": case "py":
    case "go": case "json": case "md": case "rs": case "vue":
    case "jsx": case "tsx": case "sh": case "c": case "cpp":
      return "code";
    case "doc": case "docx": case "xls": case "xlsx": case "ppt":
    case "pptx": case "txt":
      return "document";
    case "exe": case "msi": case "iso": case "apk": case "dmg":
      return "app";
    default:
      return "file";
  }
}
