/**
 * User-Agent → 可读的设备描述。
 *
 * 故意做得很轻：没有 APP，只需要在个人中心的「登录设备」列表里让用户认出
 * 「哪台是我、哪台不是我」，够用即可。判定放在前端而不是入库时固化 ——
 * 规则会随新浏览器/新机型变，库里存原始 UA 才能随时改判定重新渲染历史会话。
 *
 * 顺序有讲究：多数套壳浏览器的 UA 里同时含有 Chrome/Safari，必须先匹配更具体的。
 */
export type DeviceKind = 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown';

export interface ParsedUa {
  kind: DeviceKind;
  /** 图标名（Iconify），已在 build 时抽进 subset */
  icon: string;
  /** 形如「Windows · Chrome」 */
  label: string;
  os: string;
  browser: string;
}

function detectOs(ua: string): { os: string; kind: DeviceKind } {
  // iPadOS 13+ 的 UA 伪装成 Mac，靠 Macintosh + 触摸点区分不了（服务端拿不到），
  // 这里认 iPad 关键字，认不出就当桌面，不做过度推断
  if (/iPad/i.test(ua)) return { os: 'iPadOS', kind: 'tablet' };
  // B-16：HarmonyOS 设备 UA 同时含 Android，必须先判断 HarmonyOS 再判断 Android
  if (/HarmonyOS|OpenHarmony/i.test(ua)) return { os: 'HarmonyOS', kind: 'mobile' };
  if (/iPhone|iPod/i.test(ua)) return { os: 'iOS', kind: 'mobile' };
  if (/Android/i.test(ua)) {
    // Android 平板通常不带 Mobile 标记
    return { os: 'Android', kind: /Mobile/i.test(ua) ? 'mobile' : 'tablet' };
  }
  if (/Windows NT/i.test(ua)) return { os: 'Windows', kind: 'desktop' };
  if (/Mac OS X|Macintosh/i.test(ua)) return { os: 'macOS', kind: 'desktop' };
  if (/CrOS/i.test(ua)) return { os: 'ChromeOS', kind: 'desktop' };
  if (/Linux/i.test(ua)) return { os: 'Linux', kind: 'desktop' };
  return { os: '未知系统', kind: 'unknown' };
}

function detectBrowser(ua: string): string {
  // 先具体后笼统：Edg/OPR/各家套壳都会在 UA 里带 Chrome
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/Vivaldi/i.test(ua)) return 'Vivaldi';
  if (/QQBrowser/i.test(ua)) return 'QQ 浏览器';
  if (/MicroMessenger/i.test(ua)) return '微信内置浏览器';
  if (/UCBrowser/i.test(ua)) return 'UC 浏览器';
  if (/Quark/i.test(ua)) return '夸克';
  if (/HuaweiBrowser/i.test(ua)) return '华为浏览器';
  if (/MiuiBrowser|XiaoMi/i.test(ua)) return '小米浏览器';
  if (/SamsungBrowser/i.test(ua)) return '三星浏览器';
  if (/Firefox\/|FxiOS/i.test(ua)) return 'Firefox';
  if (/CriOS/i.test(ua)) return 'Chrome';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  return '未知浏览器';
}

const ICONS: Record<DeviceKind, string> = {
  mobile: 'mdi:cellphone',
  tablet: 'mdi:tablet',
  desktop: 'mdi:monitor',
  bot: 'mdi:robot-outline',
  unknown: 'mdi:help-circle-outline',
};

export function parseUserAgent(raw?: string | null): ParsedUa {
  const ua = (raw || '').trim();
  if (!ua) {
    return {
      kind: 'unknown',
      icon: ICONS.unknown,
      label: '未知设备',
      os: '未知系统',
      browser: '未知浏览器',
    };
  }
  if (/bot|crawler|spider|curl|wget|python-requests|okhttp/i.test(ua)) {
    return {
      kind: 'bot',
      icon: ICONS.bot,
      label: '脚本 / 爬虫',
      os: '—',
      browser: '—',
    };
  }
  const { os, kind } = detectOs(ua);
  const browser = detectBrowser(ua);
  return { kind, icon: ICONS[kind], label: `${os} · ${browser}`, os, browser };
}

/**
 * 国家/地区代码 → 中文名。只列常见的，其余直接显示原始代码 ——
 * 与其塞一份两百多条的完整表，不如让少见地区显示 "SG" 这种代码，用户一样看得懂。
 */
const COUNTRY_NAMES: Record<string, string> = {
  CN: '中国大陆', HK: '中国香港', TW: '中国台湾', MO: '中国澳门',
  JP: '日本', KR: '韩国', SG: '新加坡', MY: '马来西亚', TH: '泰国',
  VN: '越南', ID: '印尼', PH: '菲律宾', IN: '印度',
  US: '美国', CA: '加拿大', MX: '墨西哥', BR: '巴西',
  GB: '英国', DE: '德国', FR: '法国', NL: '荷兰', IT: '意大利',
  ES: '西班牙', RU: '俄罗斯', UA: '乌克兰', PL: '波兰', SE: '瑞典',
  CH: '瑞士', TR: '土耳其', AU: '澳大利亚', NZ: '新西兰', ZA: '南非',
};

/**
 * 设备列表里的位置展示。
 *
 * 城市要 CF 后台开「Add visitor location headers」才有，没开时只显示国家；
 * 两者都没有（比如内网直连、或 CF 未识别）就返回 null，调用方不渲染这一段 ——
 * 显示「未知地区」只会让用户以为出了问题。
 */
export function formatLocation(
  country?: string | null,
  city?: string | null,
): string | null {
  const countryName = country ? COUNTRY_NAMES[country] || country : null;
  if (countryName && city) return `${countryName} · ${city}`;
  return countryName || city || null;
}

/** 「3 分钟前」这类相对时间；给设备列表看活跃度用 */
export function formatRelativeTime(unixSeconds?: number | null): string {
  if (!unixSeconds) return '未知';
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 0) return '刚刚';
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`;
  return `${Math.floor(diff / 86400 / 30)} 个月前`;
}
