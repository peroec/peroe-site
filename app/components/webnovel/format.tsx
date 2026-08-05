import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Check, ClipboardCopy } from 'lucide-react';
import { getAiPrompt } from '@/lib/webnovel/api';

const FALLBACK_PROMPT = `你是交互小说（互动分支故事）的创作引擎。用户给出需求，你输出一部完整的可玩作品。

只输出 JSON，不要任何解释、不要 markdown 代码块。顶层结构必须是 title、description、tags、source；source 包含 startPage、variables、pages。

动作类型：say（文字）、image（图片地址）、timer（等待闸门）、choice（分支）、goto（跳转）、set（设置变量）、end（结局）。凡是卡进度的钥匙、手电筒、门禁卡、线索，都用 kind:item 并填写 label 和 description；只有玩家不需要知道的暗线才用 kind:flag。

硬性要求：页面 id 使用英文小写和数字且不可重复；startPage 必须存在；所有 goto 目标必须存在；至少两个 end 结局；至少一个变量和一个条件选项；每个非结局页必须有可用出口；从 start 出发每条路都能在有限步内到达 end。生成后逐项检查状态是否真的通过 set 改变、卡进度门槛是否使用 locked 和 lockLabel、所有数值增减是否符合文案。`;

const TOP_LEVEL = `{
  "title": "作品标题",
  "description": "一句话简介",
  "tags": ["悬疑", "冒险"],
  "source": {
    "startPage": "start",
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

const MINIMAL_EXAMPLE = `{
  "title": "雨夜的钥匙",
  "description": "在暴雨封锁的宅邸里找到出口。",
  "tags": ["悬疑"],
  "source": {
    "startPage": "start",
    "variables": [{"name":"hasKey","type":"bool","initial":false,"kind":"item","label":"铜钥匙","description":"打开后门"}],
    "pages": [
      {"id":"start","title":"门厅","actions":[{"id":"a1","type":"choice","options":[{"id":"o1","label":"翻找桌面","goto":"desk"},{"id":"o2","label":"直接推门","goto":"end_bad"}]}]},
      {"id":"desk","title":"书桌","actions":[{"id":"a2","type":"set","variable":"hasKey","op":"set","value":true},{"id":"a3","type":"goto","target":"door"}]},
      {"id":"door","title":"后门","actions":[{"id":"a4","type":"choice","options":[{"id":"o3","label":"用钥匙开门","goto":"end_good","locked":{"op":"var","variable":"hasKey","compare":"==","value":true},"lockLabel":"需要：铜钥匙"}]}]},
      {"id":"end_good","title":"逃出生天","actions":[{"id":"a5","type":"end"}]},
      {"id":"end_bad","title":"被雨夜吞没","actions":[{"id":"a6","type":"end"}]}
    ]
  }
}`;

function CodeBlock({ children, copyKey, copied, onCopy }: { children: string; copyKey: string; copied: string; onCopy: (key: string, text: string) => void }) {
  return (
    <div className="relative mt-3">
      <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-border bg-muted p-3 font-mono text-xs leading-relaxed">{children}</pre>
      <button type="button" className="absolute right-2 top-2 inline-flex items-center gap-1 border border-border bg-background px-2 py-1 text-xs hover:border-foreground" onClick={() => onCopy(copyKey, children)}>
        {copied === copyKey ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}{copied === copyKey ? '已复制' : '复制'}
      </button>
    </div>
  );
}

function SpecTable({ rows }: { rows: Array<[string, string, string?]> }) {
  return <div className="mt-3 overflow-x-auto border border-border"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border"><th className="px-3 py-2">字段</th><th className="px-3 py-2">形状</th><th className="px-3 py-2">说明</th></tr></thead><tbody>{rows.map(([a, b, c]) => <tr key={a} className="border-b border-border last:border-0"><td className="whitespace-nowrap px-3 py-2 font-mono">{a}</td><td className="px-3 py-2 font-mono">{b}</td><td className="px-3 py-2 text-muted-foreground">{c}</td></tr>)}</tbody></table></div>;
}

export function NovelFormat() {
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => { getAiPrompt().then((data) => setPrompt(data.prompt)).catch(() => {}); }, []);

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(''), 1500); } catch {}
  };
  const fullPrompt = prompt || FALLBACK_PROMPT;
  const rewritePrompt = `你是交互小说编辑。下面给你一份作品 JSON 和修改要求。请保留完整结构，只按要求修改，确保所有 id 唯一、所有跳转目标存在、每条路径最终能到达 end。只输出修改后的完整 JSON，不要解释、不要 markdown 代码块。\n\n作品 JSON：\n[把从创作页导出的 JSON 粘贴到这里]\n\n修改要求：\n[写清楚要改什么]`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 border-b border-border pb-5">
        <Link to="/webnovel" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">← 返回交互小说</Link>
        <h1 className="text-xl font-bold">作品格式与 AI 提示词</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">一部交互小说就是一份 JSON。下面是它的完整结构、引擎的运行规则，以及站内 AI 创作正在使用的那份<strong className="text-foreground">原版提示词</strong>。你可以整段拿走，喂给任意大模型（ChatGPT / Claude / Gemini / 本地模型都行），再把它输出的 JSON 导入进来，效果与站内创作一致，且不消耗创作点。</p>
      </header>

      <section className="border-t border-border py-6">
        <h2 className="text-base font-semibold">三步走</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm"><li>复制下面的<Link to="#prompt" className="mx-1 underline">完整提示词</Link></li><li>连同你的需求（题材、篇幅、想要几个结局）一起发给你的 AI，让它只输出 JSON</li><li>把 JSON 贴进<Link to="/webnovel/editor" className="mx-1 underline">创作页</Link>的「导入 JSON」框，导入成草稿后可继续在编辑器里改、预览、发布</li></ol>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">导入时会自动补齐缺失的 id、把悬空跳转收成结局，并跑一遍<Link to="#audit" className="mx-1 underline">可玩性体检</Link>把问题列给你。体检不拦导入，你可以先存下来再慢慢改。</p>
      </section>

      <section className="border-t border-border py-6"><h2 className="text-base font-semibold">顶层结构</h2><p className="mt-1 text-sm text-muted-foreground">导入接受的就是这个对象；导出给你的也是它</p><CodeBlock copyKey="top" copied={copied} onCopy={copy}>{TOP_LEVEL}</CodeBlock><p className="mt-3 text-xs leading-relaxed text-muted-foreground">页面数上限 80 页。每页 <code>id</code> 用英文小写和数字（如 <code>start</code> / <code>end_good</code>），<code>title</code> 用中文。动作 id、选项 id 在整部作品内唯一。</p></section>

      <section className="border-t border-border py-6"><h2 className="text-base font-semibold">页面与动作</h2><p className="mt-1 text-sm text-muted-foreground">一页 = 若干动作按顺序排布</p><CodeBlock copyKey="page" copied={copied} onCopy={copy}>{PAGE_EXAMPLE}</CodeBlock><SpecTable rows={[
        ['say', 'text、align?', '一段正文；align 可为 left / center / right'],
        ['image', 'image', '插图。没有现成图片地址就不要使用'],
        ['timer', 'duration、style、autoAdvance?', '等待闸门，挡住出口，正文立刻可见'],
        ['choice', 'options[]', '分支选项；一页可以放多个 choice，引擎会合并'],
        ['goto', 'target', '无条件跳转到目标页面'],
        ['set', 'variable、op、value', '改状态；op=set 或 add，add 可为负数'],
        ['end', '无', '结局，故事到此结束'],
      ]} /><p className="mt-3 text-xs text-muted-foreground">所有动作都支持 <code>disabled: true</code>（临时停用，不删）。</p></section>

      <section className="border-t border-border py-6"><h2 className="text-base font-semibold">状态：道具与变量</h2><p className="mt-1 text-sm text-muted-foreground">两者机制相同，区别只在玩家看不看得见</p><SpecTable rows={[
        ['name', '英文内部标识', '条件与 set 动作引用它'],
        ['type', 'bool / number / string', '状态的数据类型'],
        ['initial', '初值', '缺省为 false / 0 / 空串'],
        ['kind', 'item / flag', 'item 进入背包并对玩家可见；flag 仅作者可见'],
        ['label', '中文名', 'kind=item 时必填，背包里显示它'],
        ['description', '用途说明', '道具在背包里给玩家看的说明'],
      ]} /><p className="mt-3 text-sm leading-relaxed"><strong>血的教训：</strong>把钥匙、手电筒这类卡进度的东西做成隐藏变量时，玩家通了关却不知道自己做对了什么。所以凡是被 <code>visible</code> / <code>locked</code> 引用的状态，体检会要求它是道具。</p></section>

      <section className="border-t border-border py-6"><h2 className="text-base font-semibold">条件表达式</h2><p className="mt-1 text-sm text-muted-foreground">用在选项的 visible / locked 上</p><SpecTable rows={[
        ['var', '{op,var,compare,value}', '比较变量；compare 可为 == != > >= < <='],
        ['visited', '{op,page}', '是否到过某页'],
        ['and / or', '{op,items[]}', '全部满足 / 任一满足'],
        ['not', '{op,item}', '取反'],
        ['true', '{op:"true"}', '恒真，占位用'],
      ]} /><p className="mt-3 text-sm leading-relaxed"><code>visible</code> 不满足，选项彻底消失；<code>locked</code> 不满足，选项置灰并显示 <code>lockLabel</code>。卡进度的门槛一律用 locked，真正隐藏的秘密才用 visible。</p></section>

      <section className="border-t border-border py-6"><h2 className="text-base font-semibold">引擎怎么跑一部作品</h2><p className="mt-1 text-sm text-muted-foreground">页面之间靠 goto / choice.goto 隐式连成图，没有单独的连线数据</p><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed"><li>从 <code>startPage</code> 进入，变量按 <code>initial</code> 初始化。</li><li>进入一页时执行本页所有 set 动作，并把该页记入 visited。</li><li>image / say 按出现顺序渲染，立即可见。</li><li>timer 挡住出口，不挡正文；normal 显示秒数，secret 只显示进度条，hidden 不显示提示；autoAdvance 可在倒计时结束后自动走出口。</li><li>出口是本页第一个 choice / goto / end；多个 choice 会合并成一组选项。</li><li>选项先判 visible，再判 locked；点选后先执行 actions，再跳到 goto，没有 goto 就留在本页。</li><li>end 即结局，默认不可回退；进度保存在玩家自己的浏览器 localStorage，换设备不同步。</li></ol><p className="mt-3 text-xs text-muted-foreground">内置状态：<code>visited</code>（到过哪些页）与 <code>chosen</code>（选过哪些选项 id）由引擎自动维护。</p></section>

      <section id="prompt" className="border-t border-border py-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold">完整提示词</h2><p className="mt-1 text-sm text-muted-foreground">站内 AI 创作用的原版，整段发给你的模型，再补一句你的需求即可</p></div><button type="button" className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs hover:border-foreground" onClick={() => copy('prompt', fullPrompt)}>{copied === 'prompt' ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}{copied === 'prompt' ? '已复制' : '复制提示词'}</button></div><CodeBlock copyKey="prompt" copied={copied} onCopy={copy}>{fullPrompt}</CodeBlock><p className="mt-2 text-xs text-muted-foreground">{prompt ? `${prompt.length} 字符 · 当前站内版本` : '提示词加载中，先显示本地兼容版本'}</p></section>

      <section className="border-t border-border py-6"><h2 className="text-base font-semibold">改写已有作品的提示词</h2><p className="mt-1 text-sm text-muted-foreground">把作品导出的 JSON 和一条修改要求一起给模型，它输出改好的完整 JSON</p><CodeBlock copyKey="rewrite" copied={copied} onCopy={copy}>{rewritePrompt}</CodeBlock></section>

      <section id="audit" className="border-t border-border py-6"><h2 className="text-base font-semibold">导入前的体检</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">导入不会被拦下，但这些问题几乎都会让玩家卡住：起始页不存在、跳转目标不存在、非结局页没有出口、条件引用不存在的变量、关键道具没有 set、卡进度门槛使用了 visible、所有路径无法到达 end、探索页面原地往返。</p></section>

      <section className="border-t border-border py-6"><h2 className="text-base font-semibold">最小可用示例</h2><p className="mt-1 text-sm text-muted-foreground">3 条路径 · 2 个结局 · 1 个道具门槛。体检零问题，可直接导入试跑</p><CodeBlock copyKey="minimal" copied={copied} onCopy={copy}>{MINIMAL_EXAMPLE}</CodeBlock></section>

      <section className="border-t border-border py-6"><h2 className="text-base font-semibold">导入 / 导出</h2><p className="mt-1 text-sm text-muted-foreground">都在<Link to="/webnovel/editor" className="mx-1 underline">创作页</Link>：导入 JSON 会自动补齐缺失 id、修复悬空跳转并列出体检问题；我的作品列表可以导出标准 JSON，方便备份、改写和再次导入。</p></section>
    </div>
  );
}
