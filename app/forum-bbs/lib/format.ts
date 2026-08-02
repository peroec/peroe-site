/**
 * 自适应中文单位计数：为浏览量/访问量等大数字选择合适的单位。
 *   9990       → "9990"
 *   34500      → "3.45万"
 *   1080000    → "108万"
 *   108000000  → "1.08亿"
 * < 1 万原样输出；万/亿各保留最多 2 位小数并去掉尾随零。
 * 「次」等后缀由调用方按上下文自行拼接。
 */
export function formatCompactCount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs < 1e4) return String(Math.round(n));
  const sign = n < 0 ? '-' : '';
  if (abs < 1e8) return sign + trim(abs / 1e4) + '万';
  return sign + trim(abs / 1e8) + '亿';
}

/** 保留最多 2 位小数并去掉尾随零：108.00 → "108"，3.4500 → "3.45" */
function trim(x: number): string {
  return String(parseFloat(x.toFixed(2)));
}
