/**
 * 密码策略 —— 全站统一（注册/重置密码共用）。
 * 与后端校验保持一致：8-16 位，且不能是常见弱密码。
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 16;

const WEAK_PASSWORDS = new Set([
  '12345678', '123456789', 'password', 'qwertyui', '11111111',
  '88888888', 'abc12345', 'admin123', '1234567890',
]);

/** 过于简单（纯数字/重复字符/常见弱密码）时返回 true */
export function isWeakPassword(pw: string): boolean {
  if (WEAK_PASSWORDS.has(pw.toLowerCase())) return true;
  if (/^\d+$/.test(pw)) return true;
  if (/(.)\1{7,}/.test(pw)) return true;
  return false;
}
