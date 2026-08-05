import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Check, ClipboardCopy } from 'lucide-react';
import { getAiPrompt } from '@/lib/webnovel/api';

const FALLBACK_PROMPT = `你是交互小说（互动分支故事）的创作引擎。用户给出需求，你输出一部完整的可玩作品。

**只输出 JSON，不要任何解释、不要 markdown 代码块。** 顶层结构必须是 title、description、tags、source；source 包含 startPage、variables、pages。

动作类型：say、image、timer、choice、goto、set、end。凡是卡进度的钥匙、手电筒、门禁卡、线索，都用 kind:"item" 并填写 label 和 description；只有玩家不需要知道的暗线才用 kind:"flag"。

页面 id 使用英文小写和数字且不可重复；startPage 必须存在；所有 goto 目标必须存在；至少两个 end 结局；至少一个变量和一个条件选项；每个非结局页必须有可用出口；从 start 出发每条路都能在有限步内到达 end。生成后逐项检查状态是否真的通过 set 改变、卡进度门槛是否使用 locked 和 lockLabel、所有数值增减是否符合文案。`;

const TOP_LEVEL = `{
  "title": "作品标题",
  "description": "一句话简介",
  "tags": ["悬疑", "冒险"],
  "source": {
    "startPage": "start",        // 必须是 pages 里某一页的 id
    "variables": [ /* 状态声明，见下 */ ],
    "pages": [ /* 页面列表，见下 */ ]
  }
}`;

const PAGE_EXAMPLE = `{
  "id": "start",
  "title": "门厅",
  "actions": [
    {"id": "a1", "type": "say", "text": "门在你身后合上了。"},
    {"id": "a2", "type": "choice", "options": [
      {"id": "o1", "label": "去厨房看看", "goto": "kitchen"}
    ]}
  ]
}`;

const REWRITE_PROMPT = `你是交互小说的修改引擎。用户会给你一部**已有作品的完整 JSON**和一条**修改要求**，
你按要求改写并输出**修改后的完整作品 JSON**。

规则：
1. 输出格式与输入完全一致（title/description/tags/source），**只输出 JSON**，不要解释、不要 markdown 代码块
2. **只改用户要求的部分**，其余页面、动作、变量、id 一律原样保留 —— 用户是在已有成果上迭代，不是重新创作
3. 页面 id / 动作 id / 选项 id 尽量保持不变（新增内容才用新 id，且不能与已有 id 重复）
4. 改完仍要满足：startPage 存在、所有 goto / choice.goto 指向真实页面、至少 2 个结局、每页有中文 title
5. 动作与条件的可用类型、字段，与创作时的规范完全相同

**★ 状态一致性（改写时同样要守）★**
- 文案说“拿到/失去/记住”了什么，就要配 set 动作（选项的 actions 或目标页开头）
- 任何 visible/locked 条件引用的变量，必须有一条能先把它置成满足值的可达路径
- 每个非结局页面至少留一个**无条件可用**的出口，别让玩家无路可走
- 从 start 出发每条路都要能在有限步内抵达 end，不能出现只在几页之间来回跳的死圈
- 如果发现原作品**本身**就有上述问题（比如“拿钥匙”却没 set），**顺手修好它**

**★ 可玩性（同样要守）★**
- 卡进度的门槛用 locked + lockLabel（置灰+提示“需要：钥匙”），不要用 visible（彻底隐藏，玩家看不到线索会反复打转）；只有真正的隐藏内容才用 visible
- 卡进度的状态要声明成道具：kind:"item" + label（中文名）+ description（用途），玩家才能在背包里看到自己有什么；纯剧情暗线才用 kind:"flag"
- 探索页不要所有选项都跳回同一页而毫无变化`;

const MINIMAL_EXAMPLE = `{
  "title": "铜钥匙",
  "description": "一间空屋子，两个结局。这是能跑通的最小示例。",
  "tags": [
    "示例",
    "悬疑"
  ],
  "source": {
    "startPage": "start",
    "variables": [
      {
        "name": "hasKey",
        "type": "bool",
        "initial": false,
        "kind": "item",
        "label": "铜钥匙",
        "description": "能打开地下室的铁门"
      }
    ],
    "pages": [
      {
        "id": "start",
        "title": "门厅",
        "actions": [
          {
            "id": "a1",
            "type": "say",
            "text": "门在你身后合上了。\\n\\n门厅只剩两条路：右手边通向厨房，正前方是一扇挂着铁锁的门。"
          },
          {
            "id": "a2",
            "type": "timer",
            "duration": {
              "mode": "specific",
              "seconds": 3
            },
            "style": "normal"
          },
          {
            "id": "a3",
            "type": "choice",
            "options": [
              {
                "id": "o1",
                "label": "去厨房看看",
                "goto": "kitchen"
              },
              {
                "id": "o2",
                "label": "用钥匙打开铁门",
                "goto": "basement",
                "locked": {
                  "op": "var",
                  "variable": "hasKey",
                  "compare": "==",
                  "value": true
                },
                "lockLabel": "需要：铜钥匙"
              }
            ]
          }
        ]
      },
      {
        "id": "kitchen",
        "title": "厨房",
        "actions": [
          {
            "id": "a4",
            "type": "say",
            "text": "灶台上积了一层灰。抽屉半开着，里面有枚发黑的铜钥匙。"
          },
          {
            "id": "a5",
            "type": "choice",
            "options": [
              {
                "id": "o3",
                "label": "拿起钥匙，回到门厅",
                "goto": "start",
                "actions": [
                  {
                    "id": "s1",
                    "type": "set",
                    "variable": "hasKey",
                    "op": "set",
                    "value": true
                  }
                ]
              },
              {
                "id": "o4",
                "label": "从后门溜走，不再回头",
                "goto": "end_escape"
              }
            ]
          }
        ]
      },
      {
        "id": "basement",
        "title": "地下室",
        "actions": [
          {
            "id": "a7",
            "type": "say",
            "text": "铁门开了。台阶下面，有人替你留了一盏还亮着的灯。"
          },
          {
            "id": "a8",
            "type": "choice",
            "options": [
              {
                "id": "o5",
                "label": "走下去",
                "goto": "end_good"
              }
            ]
          }
        ]
      },
      {
        "id": "end_escape",
        "title": "结局：逃走",
        "actions": [
          {
            "id": "a9",
            "type": "say",
            "text": "你再没弄清那扇铁门后面是什么。"
          },
          {
            "id": "a10",
            "type": "end"
          }
        ]
      },
      {
        "id": "end_good",
        "title": "结局：灯下",
        "actions": [
          {
            "id": "a11",
            "type": "say",
            "text": "灯是给你留的。他等了很久。"
          },
          {
            "id": "a12",
            "type": "end"
          }
        ]
      }
    ]
  }
}`;

type CopyKey = 'prompt' | 'rewrite' | 'example';

function CopyButton({ text, label, copyKey, copied, onCopy }: { text: string; label: string; copyKey: CopyKey; copied: CopyKey | ''; onCopy: (key: CopyKey, text: string) => void }) {
  return <button type="button" className="inline-flex shrink-0 items-center justify-center gap-1 border border-border bg-transparent px-2 py-1 font-mono text-xs text-foreground hover:border-foreground hover:bg-foreground hover:text-background" onClick={() => onCopy(copyKey, text)}>{copied === copyKey ? <Check className="size-3" /> : <ClipboardCopy className="size-3" />}{copied === copyKey ? '已复制' : label}</button>;
}

function CodeBlock({ children }: { children: string }) {
  return <div className="overflow-x-auto border border-border bg-muted/30"><pre className="whitespace-pre p-3 font-mono text-xs leading-relaxed">{children}</pre></div>;
}

function SectionHeader({ title, description, copy }: { title: string; description?: string; copy?: React.ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-base font-semibold">{title}</h2>{description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}</div>{copy && <div className="shrink-0">{copy}</div>}</div>;
}

function SpecTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="mt-3 overflow-x-auto"><table className="w-full border-t border-border text-sm"><thead><tr className="text-left text-xs text-muted-foreground">{headers.map((header) => <th key={header} className="whitespace-nowrap py-2 pr-3">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-b border-border align-top">{row.map((cell, cellIndex) => <td key={cellIndex} className={`${cellIndex === 0 ? 'whitespace-nowrap font-mono' : ''} py-2 pr-3`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export function NovelFormat() {
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState<CopyKey | ''>('');

  useEffect(() => { getAiPrompt().then((data) => setPrompt(data.prompt)).catch(() => {}); }, []);

  const copy = async (key: CopyKey, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(''), 1500); } catch {}
  };
  const fullPrompt = prompt || FALLBACK_PROMPT;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <header className="mb-2">
        <Link to="/webnovel" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">← 返回交互小说</Link>
        <h1 className="text-xl font-bold">作品格式与 AI 提示词</h1>
        <p className="mt-1 text-sm text-muted-foreground">一部交互小说就是一份 JSON。下面是它的完整结构、引擎的运行规则， 以及站内 AI 创作正在使用的那份<strong className="text-foreground">原版提示词</strong> —— 你可以整段拿走， 喂给任意大模型（ChatGPT / Claude / Gemini / 本地模型都行）， 再把它输出的 JSON 导入进来，效果与站内创作一致，且不消耗创作点。</p>
      </header>

      <div className="my-5 -mx-4 border-y border-border bg-muted/20 px-4 py-5 sm:mx-0 sm:border sm:p-5">
        <h2 className="mb-2 text-sm font-semibold">三步走</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm"><li>复制下面的<Link to="#prompt" className="mx-1 underline">完整提示词</Link></li><li>连同你的需求（题材、篇幅、想要几个结局）一起发给你的 AI，让它只输出 JSON</li><li>把 JSON 贴进<Link to="/webnovel/editor" className="mx-1 underline">创作页</Link>的「导入 JSON」框，导入成草稿后可继续在编辑器里改、预览、发布</li></ol>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">导入时会自动补齐缺失的 id、把悬空跳转收成结局，并跑一遍<Link to="#audit" className="mx-1 underline">可玩性体检</Link>把问题列给你 —— 体检不拦导入，你可以先存下来再慢慢改。</p>
      </div>

      <section className="border-t border-border py-6"><SectionHeader title="顶层结构" description="导入接受的就是这个对象；导出给你的也是它" /><CodeBlock>{TOP_LEVEL}</CodeBlock><p className="mt-2 text-sm text-muted-foreground">页面数上限 80 页。每页 <code className="font-mono">id</code> 用英文小写 + 数字（如 <code className="font-mono">start</code> / <code className="font-mono">end_good</code>），<code className="font-mono">title</code> 用中文（编辑器里显示的是它）。动作 id、选项 id 在整部作品内唯一。</p></section>

      <section className="border-t border-border py-6"><SectionHeader title="页面与动作" description="一页 = 若干动作按顺序排布" /><CodeBlock>{PAGE_EXAMPLE}</CodeBlock><SpecTable headers={['type', '字段', '说明']} rows={[
        ['say', 'text（必填）、align?: left/center/right', '一段正文。用 \\n\\n 分段'],
        ['image', 'image（图片地址）', '插图。没有现成图片地址就别用这个动作'],
        ['timer', 'duration: {mode:"specific",seconds} 或 {mode:"range",min,max}、style: normal/secret/hidden、autoAdvance?', '等待闸门。挡住的是出口，正文立刻就能看'],
        ['choice', 'options[]: {id,label,goto?,actions?,visible?,locked?,lockLabel?}', '分支选项。一页可以放多个 choice，引擎会合并成一组'],
        ['goto', 'target（目标页面 id）', '无条件跳转'],
        ['set', 'variable、op: set/add、value', '改状态。op=add 用于数值增减（可为负）'],
        ['end', '（无）', '结局，故事到此结束'],
      ]} /><p className="mt-2 text-xs text-muted-foreground">所有动作都支持 <code className="font-mono">disabled: true</code>（临时停用，不删）。</p></section>

      <section className="border-t border-border py-6"><SectionHeader title="状态：道具与变量" description="两者机制相同，区别只在玩家看不看得见" /><SpecTable headers={['字段', '说明']} rows={[
        ['name', '内部标识（英文），条件与 set 动作引用它'],
        ['type', 'bool / number / string'],
        ['initial', '初值。缺省 false / 0 / 空串'],
        ['kind', 'item = 道具，玩家可见、进背包、获得时有提示；flag = 变量，仅作者可见（缺省）。凡是卡进度的东西一律用 item'],
        ['label', '道具中文名（kind 为 item 时必填），背包里显示的就是它'],
        ['description', '道具用途说明，背包里给玩家看'],
      ]} /><p className="mt-3 text-sm leading-relaxed"><strong>血的教训</strong>：把钥匙、手电筒这类卡进度的东西做成隐藏变量时，玩家通了关却完全不知道自己做对了什么 ——「点着点着就结束了」。所以凡是被 <code className="font-mono">visible</code> / <code className="font-mono">locked</code> 条件引用的状态，体检会强制要求它是道具。</p></section>

      <section className="border-t border-border py-6"><SectionHeader title="条件表达式" description="用在选项的 visible / locked 上" /><SpecTable headers={['op', '形状', '说明']} rows={[
        ['var', '{"op":"var","variable":"hasKey","compare":"==","value":true}', '比较变量。compare 可用 == != > >= < <='],
        ['visited', '{"op":"visited","page":"kitchen"}', '是否到过某页'],
        ['and / or', '{"op":"and","items":[条件, 条件]}', '全部满足 / 任一满足'],
        ['not', '{"op":"not","item":条件}', '取反'],
        ['true', '{"op":"true"}', '恒真（占位用）'],
      ]} /><p className="mt-3 text-sm leading-relaxed"><code className="font-mono">visible</code> 不满足 → 选项<strong>彻底消失</strong>；<code className="font-mono">locked</code> 不满足 → 选项<strong>置灰</strong>并显示 <code className="font-mono">lockLabel</code>（如「需要：铜钥匙」）。卡进度的门槛一律用 locked —— 用 visible 的话玩家看不到门、也不知道自己缺什么，只有真正的隐藏内容才用 visible。</p></section>

      <section className="border-t border-border py-6"><SectionHeader title="引擎怎么跑一部作品" description="页面之间靠 goto / choice.goto 隐式连成图，没有单独的连线数据" /><ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed"><li>从 <code className="font-mono">startPage</code> 进入。变量按 <code className="font-mono">initial</code> 初始化。</li><li><strong>进入一页时立刻执行本页所有 set 动作</strong>，并把该页记入 <code className="font-mono">visited</code>。所以「进这一页就等于拿到某物」可以直接在页面开头放 set。</li><li>本页所有 <code className="font-mono">image</code> / <code className="font-mono">say</code> 按出现顺序渲染成内容，<strong>立即可见</strong>。</li><li>若本页有 <code className="font-mono">timer</code>：<strong>它挡住的是出口，不是正文</strong>。倒计时结束后出口才出现；normal 显示剩余秒、secret 只给进度条、hidden 什么都不显示。<code className="font-mono">autoAdvance: true</code> 时倒计时一到自动走 goto/end 出口，不用点「继续」；<code className="font-mono">range</code> 模式每次进入随机取一个秒数。</li><li><strong>出口 = 本页第一个 choice / goto / end</strong>。同一页上的<strong>多个 choice 会合并</strong>成一组选项（作者常把不同分支拆成几块，各带条件）；<code className="font-mono">goto</code> / <code className="font-mono">end</code> 只有出现在所有 choice 之前才作为出口。</li><li>选项先判 <code className="font-mono">visible</code>（不满足则不渲染），再判 <code className="font-mono">locked</code>（不满足则置灰不可点）。点选后<strong>先执行该选项自带的 actions</strong>（通常是 set），再跳到 <code className="font-mono">goto</code>；没有 goto 就留在本页。</li><li><code className="font-mono">end</code> 即结局，<strong>默认不可回退</strong>（选择即后果）。进度存在读者自己的浏览器 localStorage 里，换设备不同步、也不占账号。</li></ol><p className="mt-3 text-sm text-muted-foreground">内置状态：<code className="font-mono">visited</code>（到过哪些页）与 <code className="font-mono">chosen</code>（选过哪些选项 id）由引擎自动维护，条件里用 <code className="font-mono">{"{\"op\":\"visited\",\"page\":\"…\"}"}</code> 读取。</p></section>

      <section id="prompt" className="scroll-mt-16 border-t border-border py-6"><SectionHeader title="完整提示词" description="站内 AI 创作用的原版，逐字一致。整段发给你的模型，再补一句你的需求即可" copy={<CopyButton text={fullPrompt} label="复制提示词" copyKey="prompt" copied={copied} onCopy={copy} />} /><CodeBlock>{fullPrompt}</CodeBlock><p className="mt-2 text-xs text-muted-foreground">{prompt ? `${prompt.length} 字符 · 规范版本 v1` : '提示词加载中…'}</p></section>

      <section className="border-t border-border py-6"><SectionHeader title="改写已有作品的提示词" description="把作品导出的 JSON 和一条修改要求一起给模型，它输出改好的完整 JSON" copy={<CopyButton text={REWRITE_PROMPT} label="复制" copyKey="rewrite" copied={copied} onCopy={copy} />} /><CodeBlock>{REWRITE_PROMPT}</CodeBlock></section>

      <section id="audit" className="scroll-mt-16 border-t border-border py-6"><SectionHeader title="导入前的体检" description="导入不会被拦下，但这些问题会原样列给你 —— 它们几乎都会让玩家卡住" /><SpecTable headers={['代码', '问题']} rows={[
        ['UNDECLARED_VAR', '条件引用了 variables 里没声明的变量'],
        ['NEVER_ASSIGNED', '变量从未被任何 set 动作赋值，依赖它的选项永远不满足（文案里“拿到”了东西却忘了写 set）'],
        ['NO_EXIT', '非结局页面没有任何出口（既无 goto 也无选项）'],
        ['ALL_CONDITIONAL', '一页的所有选项都带条件，条件都不满足时玩家无路可走'],
        ['NO_PATH_TO_END', '从某页出发无论怎么选都到不了任何结局（死循环）'],
        ['HIDDEN_GATE', '某页只能通过 visible 隐藏选项进入 —— 门根本不显示，玩家不知道自己缺什么。改用 locked + lockLabel'],
        ['INVISIBLE_GATE_STATE', '被用作门槛条件的状态是隐藏变量（kind:"flag"）。改成 kind:"item" 并补 label / description'],
        ['ITEM_NO_LABEL', '道具（kind:"item"）没写 label，背包里只会显示英文标识'],
        ['ROUND_TRIP', '一页的所有选项都跳回同一页且不改变任何状态 —— 选了等于没选（有 set 时降为 warn）'],
        ['UNREACHABLE', '页面从起点不可达（孤岛页）'],
        ['NO_TITLE', '页面缺中文 title，编辑器里只能看到英文 id'],
      ]} /><p className="mt-3 text-xs text-muted-foreground">红色为 error（玩家会被卡住），灰色为 warn（可玩但有瑕疵）。共 11 项。</p></section>

      <section className="border-t border-border py-6"><SectionHeader title="最小可用示例" description="3 条路径 · 2 个结局 · 1 个道具门槛。体检零问题，可直接导入试跑" copy={<CopyButton text={MINIMAL_EXAMPLE} label="复制示例" copyKey="example" copied={copied} onCopy={copy} />} /><CodeBlock>{MINIMAL_EXAMPLE}</CodeBlock></section>

      <section className="border-t border-border py-6"><SectionHeader title="导入 / 导出" description="都在创作页" /><div className="space-y-3 text-sm leading-relaxed"><p><strong>导入：</strong>创作页顶部「导入 JSON」，粘贴文本或上传 .json 文件。允许带 markdown 代码块和模型的客套话，会自动抠出 JSON；pages 放在顶层、外面裹了一层 novel 之类的常见变形也能识别。导入后是草稿，不会自动公开。</p><p><strong>导出：</strong>我的作品每行的「导出」按钮，下载的就是上面那个顶层结构。拿它配合改写提示词，可以让 AI 在你已有的成果上继续改。</p><Link to="/webnovel/editor" className="inline-block underline">去创作页</Link></div></section>
    </div>
  );
}
