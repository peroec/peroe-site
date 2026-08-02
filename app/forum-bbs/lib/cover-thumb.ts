/**
 * 论坛配图（头像 / 帖子封面）。
 *
 * 2026-07-31：全站拆分后论坛独立为 bbs.acofork.com，缩略图端点 /thumb
 * 在 VPS 上、不归论坛 Worker 管。退回 S3 原图直出，待缩略图服务独立部署
 * 后再恢复。
 */
export function remoteThumb(url: string, _width?: number): string {
  return url;
}
