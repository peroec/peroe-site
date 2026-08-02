import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Download, Trash2, Inbox } from 'lucide-react';

// ─── 数据模型 ─────────────────────────────────────────────────────────────────
// 五行梯队标签从上到下正好读成「从夯到拉」——从最夯到最拉的排名梗。

interface TierItem {
  id: string;
  src: string;
  /** 宽高比 = naturalWidth / naturalHeight，用于保持原始比例展示（异形图不裁成正方形） */
  ratio: number;
}

interface TierDef {
  id: string;
  label: string;
  /** 左侧标签块底色 */
  color: string;
}

const TIERS: TierDef[] = [
  { id: 'hang', label: '夯', color: '#e5484d' }, // 红
  { id: 'top', label: '顶级', color: '#f08a3c' }, // 橙
  { id: 'elite', label: '人上人', color: '#f2c94c' }, // 黄
  { id: 'npc', label: 'NPC', color: '#f5cfa8' }, // 肤色
  { id: 'la', label: '拉', color: '#ffffff' }, // 白
];

type ZoneId = string; // tier id 或 'pool'

type Board = Record<ZoneId, TierItem[]>;

const emptyBoard = (): Board => {
  const b: Board = { pool: [] };
  for (const t of TIERS) b[t.id] = [];
  return b;
};

interface DragState {
  item: TierItem;
  from: ZoneId;
  x: number;
  y: number;
  over: ZoneId | null;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const DEFAULT_TITLE = '从夯到拉';

/** 拖拽时触发自动滚动的视口上下边缘带宽（px）。顶部要盖住 56px 的顶栏 */
const EDGE_ZONE = 96;
/** 指针贴到最边上时的滚动速度（px/帧，60fps 下约 1080px/s） */
const EDGE_MAX_SPEED = 18;

export function meta() {
  return [
    { title: "Tier List 制作器 | peroe" },
    { name: "description", content: "从夯到拉 —— 拖拽图片做梯队排名，导出 PNG" },
  ];
}

export default function TierPage() {
  
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [title, setTitle] = useState(DEFAULT_TITLE);

  const zoneRefs = useRef<Record<ZoneId, HTMLElement | null>>({});
  // 记录已创建的 object URL，卸载时统一释放，避免内存泄漏
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  // ─── 上传 / 加图 ──────────────────────────────────────────────────────────
  // 把图片文件追加到指定区域（待排池或某个梯队行），供文件选择与外部拖入共用。
  const addFilesToZone = useCallback((files: FileList | File[], zone: ZoneId) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    // 先解码拿到原始尺寸算出宽高比，再一次性入池，保证插入顺序与选择顺序一致
    Promise.all(
      imgs.map(
        (file) =>
          new Promise<TierItem>((resolve) => {
            const src = URL.createObjectURL(file);
            urlsRef.current.push(src);
            const im = new Image();
            im.onload = () =>
              resolve({
                id: uid(),
                src,
                ratio: im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1,
              });
            im.onerror = () => resolve({ id: uid(), src, ratio: 1 });
            im.src = src;
          }),
      ),
    ).then((next) => {
      if (next.length) setBoard((b) => ({ ...b, [zone]: [...b[zone], ...next] }));
    });
  }, []);

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFilesToZone(e.target.files, 'pool');
      e.target.value = '';
    },
    [addFilesToZone],
  );

  // 外部文件拖入：高亮当前悬停的落区，松手把图片加进去。
  // 与内部指针拖拽走不同事件通道（原生 DnD vs pointer），互不干扰。
  const [fileOver, setFileOver] = useState<ZoneId | null>(null);

  const dropHandlers = useCallback(
    (zone: ZoneId) => ({
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setFileOver((prev) => (prev === zone ? prev : zone));
      },
      onDragLeave: (e: React.DragEvent) => {
        // 只有真正离开落区边界才清除（进入子元素时 relatedTarget 仍在区域内）
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
          setFileOver((prev) => (prev === zone ? null : prev));
        }
      },
      onDrop: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        setFileOver(null);
        if (e.dataTransfer.files.length) addFilesToZone(e.dataTransfer.files, zone);
      },
    }),
    [addFilesToZone],
  );

  // 拖到窗口外/异常结束时清掉高亮
  useEffect(() => {
    const clear = () => setFileOver(null);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);

  const clearAll = useCallback(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setBoard(emptyBoard());
  }, []);

  // ─── 拖拽核心 ─────────────────────────────────────────────────────────────
  // 指针事件实现，鼠标与触摸通用；跟手的悬浮预览 + 落点区域计算。

  const zoneAtPoint = useCallback((x: number, y: number): ZoneId | null => {
    for (const [id, el] of Object.entries(zoneRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }, []);

  /** 在目标区域内，根据指针位置算出插入下标（跳过正在拖拽的卡片本身） */
  const indexAtPoint = useCallback(
    (zone: ZoneId, x: number, y: number, draggingId: string): number => {
      const el = zoneRefs.current[zone];
      if (!el) return 0;
      const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-card]')).filter(
        (c) => c.dataset.card !== draggingId,
      );
      for (let i = 0; i < cards.length; i++) {
        const r = cards[i].getBoundingClientRect();
        // 指针位于该卡片所在行（y 在其下边界以上）且在其水平中线左侧 → 插到它前面
        if (y < r.bottom && x < r.left + r.width / 2) return i;
      }
      return cards.length;
    },
    [],
  );

  const moveItem = useCallback((id: string, from: ZoneId, to: ZoneId, index: number) => {
    setBoard((b) => {
      const src = [...b[from]];
      const i = src.findIndex((x) => x.id === id);
      if (i < 0) return b;
      const [it] = src.splice(i, 1);
      if (from === to) {
        const idx = Math.max(0, Math.min(index, src.length));
        src.splice(idx, 0, it);
        return { ...b, [from]: src };
      }
      const dst = [...b[to]];
      const idx = Math.max(0, Math.min(index, dst.length));
      dst.splice(idx, 0, it);
      return { ...b, [from]: src, [to]: dst };
    });
  }, []);

  const onCardPointerDown = useCallback(
    (e: React.PointerEvent, item: TierItem, from: ZoneId) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const startX = e.clientX;
      const startY = e.clientY;
      let started = false;
      // 指针的最新视口坐标 —— 自动滚动那条 rAF 循环要读它，而手指停在
      // 边缘不动时是不会再有 pointermove 的，所以必须存下来而不是靠事件传。
      let px = startX;
      let py = startY;
      let raf: number | null = null;

      // 拖拽期间浏览器不会自己滚页（卡片 touch-none + 下面的 preventDefault，
      // 否则一按住就跟着滚）。手机视口装不下「5 行梯队 + 待排池」，没有这段
      // 循环就永远够不到屏幕外的行 —— 从池里拿起图，指针顶到屏幕上沿也拖不到「夯」。
      // 越贴近边缘滚得越快；滚完要重算 over：页面动了、手指没动，
      // 落区的 rect 已经不是刚才那个了。
      const tick = () => {
        const h = window.innerHeight;
        let dy = 0;
        if (py < EDGE_ZONE) dy = -EDGE_MAX_SPEED * (1 - py / EDGE_ZONE);
        else if (py > h - EDGE_ZONE) dy = EDGE_MAX_SPEED * (1 - (h - py) / EDGE_ZONE);
        if (dy) {
          const before = window.scrollY;
          window.scrollBy(0, dy);
          // 已经滚到头就没必要重算：什么都没变
          if (window.scrollY !== before) {
            const over = zoneAtPoint(px, py);
            setDrag((d) => (d && d.over !== over ? { ...d, over } : d));
          }
        }
        raf = requestAnimationFrame(tick);
      };

      const stopAutoScroll = () => {
        if (raf !== null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      };

      // 监听挂在 window 上：pointermove/up 冒泡到 window，
      // 无需 setPointerCapture，也不受拖拽期间卡片重渲染影响，鼠标/触摸通用。
      const move = (ev: PointerEvent) => {
        if (!started) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
          started = true;
          raf = requestAnimationFrame(tick);
        }
        ev.preventDefault();
        px = ev.clientX;
        py = ev.clientY;
        const over = zoneAtPoint(px, py);
        setDrag({ item, from, x: px, y: py, over });
      };

      const finish = (ev: PointerEvent) => {
        stopAutoScroll();
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        if (started) {
          const over = zoneAtPoint(ev.clientX, ev.clientY);
          if (over) {
            const idx = indexAtPoint(over, ev.clientX, ev.clientY, item.id);
            moveItem(item.id, from, over, idx);
          }
        }
        setDrag(null);
      };

      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    },
    [zoneAtPoint, indexAtPoint, moveItem],
  );

  // ─── 导出为图片 ───────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  const exportImage = useCallback(async () => {
    setExporting(true);
    try {
      const loadImg = (src: string) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = rej;
          im.src = src;
        });

      const imgMap = new Map<string, HTMLImageElement>();
      for (const t of TIERS) {
        for (const it of board[t.id]) {
          imgMap.set(it.id, await loadImg(it.src));
        }
      }

      const dpr = 2;
      const width = 900;
      const labelW = 96;
      const cellH = 100; // 固定行高，单元格宽度按各图原始比例伸缩
      const gap = 6;
      const contentW = width - labelW;
      const maxCellW = contentW - 2 * gap; // 超宽图的宽度上限（占满一整行）

      type Placed = { im: HTMLImageElement; x: number; w: number; line: number };
      // 逐行流式布局：固定高度、按比例算宽度，宽度超出可用区就换行
      const layouts = TIERS.map((t) => {
        const placed: Placed[] = [];
        let line = 0;
        let x = gap;
        for (const it of board[t.id]) {
          const im = imgMap.get(it.id);
          if (!im) continue;
          const ratio = im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1;
          const w = Math.max(1, Math.min(Math.round(cellH * ratio), maxCellW));
          if (x > gap && x + w + gap > contentW) {
            line += 1;
            x = gap;
          }
          placed.push({ im, x, w, line });
          x += w + gap;
        }
        return placed;
      });

      const rowHeights = layouts.map((placed) => {
        const lines = placed.length ? Math.max(...placed.map((p) => p.line)) + 1 : 1;
        return lines * cellH + (lines + 1) * gap;
      });
      const titleText = title.trim();
      const titleH = titleText ? 78 : 0;
      const totalH = titleH + rowHeights.reduce((a, b) => a + b, 0) + (TIERS.length + 1) * 2;

      const canvas = document.createElement('canvas');
      canvas.width = width * dpr;
      canvas.height = totalH * dpr;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#171717';
      ctx.fillRect(0, 0, width, totalH);

      // 标题
      if (titleText) {
        ctx.fillStyle = '#ededed';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let tFont = 46;
        do {
          ctx.font = `bold ${tFont}px sans-serif`;
          if (ctx.measureText(titleText).width <= width - 32) break;
          tFont -= 2;
        } while (tFont > 16);
        ctx.fillText(titleText, width / 2, titleH / 2);
      }

      let y = titleH + 2;
      for (let ti = 0; ti < TIERS.length; ti++) {
        const t = TIERS[ti];
        const h = rowHeights[ti];

        // 行背景
        ctx.fillStyle = '#0f0f0f';
        ctx.fillRect(labelW, y, contentW, h);

        // 标签块
        ctx.fillStyle = t.color;
        ctx.fillRect(0, y, labelW, h);
        ctx.fillStyle = '#171717';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 字号自适应：缩到标签宽度内（多字标签如「人上人」「NPC」不溢出）
        let fontSize = 40;
        do {
          ctx.font = `bold ${fontSize}px sans-serif`;
          if (ctx.measureText(t.label).width <= labelW - 14) break;
          fontSize -= 2;
        } while (fontSize > 12);
        ctx.fillText(t.label, labelW / 2, y + h / 2);

        // 缩略图（保持原始比例，等比缩放填入 w×cellH 的框内，不裁切）
        for (const p of layouts[ti]) {
          const cx = labelW + p.x;
          const cy = y + gap + p.line * (cellH + gap);
          const ir = p.im.naturalHeight ? p.im.naturalWidth / p.im.naturalHeight : 1;
          let dw = p.w;
          let dh = dw / ir;
          if (dh > cellH) {
            dh = cellH;
            dw = dh * ir;
          }
          ctx.drawImage(p.im, cx + (p.w - dw) / 2, cy + (cellH - dh) / 2, dw, dh);
        }

        y += h + 2;
      }

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.trim() || DEFAULT_TITLE}.png`;
      a.click();
      // 只报张数，不报标题 —— 标题是用户自己写的内容
          } finally {
      setExporting(false);
    }
  }, [board, title]);

  const totalCount = Object.values(board).reduce((a, arr) => a + arr.length, 0);

  // ─── 渲染 ─────────────────────────────────────────────────────────────────
  const renderCard = (item: TierItem, zone: ZoneId) => {
    const isDragging = drag?.item.id === item.id;
    // 高度固定、宽度按原始比例伸缩：正方形照旧，异形图保持原比例不被裁切
    return (
      <div
        key={item.id}
        data-card={item.id}
        onPointerDown={(e) => onCardPointerDown(e, item, zone)}
        style={{ height: 72, width: 72 * item.ratio }}
        className={`relative shrink-0 cursor-grab touch-none overflow-hidden border border-border bg-background select-none active:cursor-grabbing ${
          isDragging ? 'opacity-30' : ''
        }`}
      >
        <img
          src={item.src}
          alt=""
          draggable={false}
          className="pointer-events-none size-full object-cover"
        />
      </div>
    );
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
      {/* 页面的可见标题是下面那个可编辑 input（会被用户改写、也会进导出的图），
          所以额外给一个视觉隐藏的 h1 —— 否则整页没有一级标题。 */}
      <h1 className="sr-only">Tier List 制作器</h1>
      {/* 可自定义标题：默认「从夯到拉」，点击即可改，字号大方便截图 */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={DEFAULT_TITLE}
        aria-label="标题（可自定义）"
        spellCheck={false}
        className="w-full border-b border-transparent bg-transparent py-2 text-center text-3xl font-bold transition-colors outline-none hover:border-border/50 focus:border-border sm:text-4xl"
      />

      {/* 梯队面板 —— 窄屏只留上下边，左右不吃宽度 */}
      <div className="border-y border-border sm:border">
        {TIERS.map((t, i) => {
          const items = board[t.id];
          const isOver = drag?.over === t.id || fileOver === t.id;
          return (
            <div key={t.id} className={`flex items-stretch ${i > 0 ? 'border-t border-border' : ''}`}>
              {/* 标签块 */}
              <div
                className="flex w-16 shrink-0 items-center justify-center px-1 text-center leading-tight font-bold text-[#171717]"
                style={{
                  backgroundColor: t.color,
                  fontSize:
                    t.label.length >= 3 ? '1.05rem' : t.label.length === 2 ? '1.5rem' : '1.875rem',
                }}
              >
                {t.label}
              </div>
              {/* 落区 */}
              <div
                data-zone={t.id}
                ref={(el) => {
                  zoneRefs.current[t.id] = el;
                }}
                {...dropHandlers(t.id)}
                className={`flex min-h-[88px] flex-1 flex-wrap content-start gap-1.5 p-1.5 transition-colors ${
                  fileOver === t.id
                    ? 'bg-foreground/10 ring-2 ring-primary ring-inset'
                    : isOver
                      ? 'bg-foreground/10'
                      : 'bg-background/40'
                }`}
              >
                {items.map((it) => renderCard(it, t.id))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 操作区 */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex">
          <input type="file" accept="image/*" multiple onChange={onFileInput} className="hidden" />
          <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90">
            <ImagePlus className="size-4" />
            上传图片
          </span>
        </label>
        <button type="button" onClick={exportImage} disabled={totalCount === 0 || exporting} className="inline-flex h-9 items-center gap-1.5 border border-border px-3 text-sm text-muted transition-colors hover:text-white disabled:opacity-50">
          <Download className="size-4" />
          {exporting ? '生成中…' : '保存图片'}
        </button>
        <button type="button" onClick={clearAll} disabled={totalCount === 0} className="inline-flex h-9 items-center gap-1.5 border border-border px-3 text-sm text-muted transition-colors hover:text-white disabled:opacity-50">
          <Trash2 className="size-4" />
          清空
        </button>
      </div>

      {/* 图片池 */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground/60 uppercase">
          <Inbox className="size-3.5" />
          待排图片（{board.pool.length}）
        </div>
        <div
          data-zone="pool"
          ref={(el) => {
            zoneRefs.current.pool = el;
          }}
          {...dropHandlers('pool')}
          className={`flex min-h-[96px] flex-wrap content-start gap-1.5 border border-dashed p-2 transition-colors ${
            fileOver === 'pool'
              ? 'border-primary bg-foreground/10 ring-2 ring-primary ring-inset'
              : drag?.over === 'pool'
                ? 'border-border bg-foreground/10'
                : 'border-border'
          }`}
        >
          {board.pool.length === 0 ? (
            <div className="flex w-full items-center justify-center py-6 text-sm text-muted-foreground/50">
              上传或从外部拖拽图片到这里，再拖到上面的行进行排名
            </div>
          ) : (
            board.pool.map((it) => renderCard(it, 'pool'))
          )}
        </div>
      </div>

      {/* 跟手的拖拽预览 */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 overflow-hidden border-2 border-primary shadow-lg"
          style={{ left: drag.x, top: drag.y, height: 72, width: 72 * drag.item.ratio }}
        >
          <img src={drag.item.src} alt="" className="size-full object-cover" />
        </div>
      )}
    </main>
  );
}
