export type NovelVariableType = 'bool' | 'number' | 'string';
export type NovelVariableKind = 'item' | 'flag';

export interface NovelVariable {
  name: string;
  type: NovelVariableType;
  initial: boolean | number | string;
  kind: NovelVariableKind;
  label?: string;
  description?: string;
}

export interface NovelCondition {
  op: 'true' | 'visited' | 'var' | 'and' | 'or' | 'not';
  page?: string;
  variable?: string;
  compare?: '==' | '!=' | '>' | '>=' | '<' | '<=';
  value?: boolean | number | string;
  items?: NovelCondition[];
  item?: NovelCondition;
}

export interface NovelDuration {
  mode: 'specific' | 'range';
  seconds?: number;
  min?: number;
  max?: number;
}

export interface NovelOption {
  id: string;
  label: string;
  goto?: string;
  actions?: NovelAction[];
  visible?: NovelCondition;
  locked?: NovelCondition;
  lockLabel?: string;
}

export interface NovelAction {
  id: string;
  type: 'image' | 'say' | 'timer' | 'choice' | 'goto' | 'set' | 'end';
  image?: string;
  text?: string;
  align?: 'left' | 'center' | 'right';
  duration?: NovelDuration;
  style?: 'normal' | 'secret' | 'hidden';
  autoAdvance?: boolean;
  options?: NovelOption[];
  target?: string;
  variable?: string;
  op?: 'set' | 'add';
  value?: boolean | number | string;
  disabled?: boolean;
}

export interface NovelPage {
  id: string;
  title?: string;
  actions: NovelAction[];
  // 旧版字段，仅用于读取历史作品并归一化。
  narrative?: string;
  choices?: Array<{
    id: string;
    text: string;
    condition?: NovelCondition;
    actions?: Array<{ type: 'set' | 'goto'; variable?: string; op?: '+' | '-' | '='; value?: number; target?: string }>;
  }>;
}

export interface NovelSource {
  startPage: string;
  variables: NovelVariable[];
  pages: NovelPage[];
}

export interface NovelViewState {
  pageId: string;
  variables: Record<string, boolean | number | string>;
  visited: string[];
  chosen: string[];
}

function actionId(prefix = 'a'): string {
  return `${prefix}${crypto.randomUUID().slice(0, 8)}`;
}

function starterPage(): NovelPage {
  return {
    id: 'start',
    title: '开始',
    actions: [{ id: actionId(), type: 'say', text: '', align: 'left' }],
  };
}

export function createStarterSource(): NovelSource {
  return { startPage: 'start', variables: [], pages: [starterPage()] };
}

function legacyActionId(): string {
  return actionId('legacy-');
}

/** 将第一版 narrative/choices 数据转换为动作序列，兼容已保存草稿。 */
export function normalizeSource(raw: unknown): NovelSource {
  if (!raw || typeof raw !== 'object') return createStarterSource();
  const input = raw as Partial<NovelSource> & { pages?: Array<NovelPage> };
  if (!Array.isArray(input.pages) || input.pages.length === 0) return createStarterSource();

  const pages = input.pages.map((page) => {
    if (Array.isArray(page.actions)) return { ...page, actions: page.actions.map((action) => ({ ...action })) };
    const actions: NovelAction[] = [];
    if (page.narrative) actions.push({ id: legacyActionId(), type: 'say', text: page.narrative, align: 'left' });
    // 空 choices 数组 = 结局页，不生成空分支动作（否则会被判定为"有分支但无选项"卡在页尾）
    if (Array.isArray(page.choices) && page.choices.length > 0) {
      actions.push({
        id: legacyActionId(),
        type: 'choice',
        options: page.choices.map((choice) => ({
          id: choice.id,
          label: choice.text,
          visible: choice.condition,
          actions: (choice.actions || []).map((action) => {
            if (action.type === 'goto') return { id: legacyActionId(), type: 'goto', target: action.target };
            return {
              id: legacyActionId(),
              type: 'set',
              variable: action.variable,
              op: action.op === '+' ? 'add' : 'set',
              value: action.value,
            };
          }),
        })),
      });
    }
    return { id: page.id, title: page.title || page.id, actions };
  });

  return {
    startPage: pages.some((page) => page.id === input.startPage) ? String(input.startPage) : pages[0].id,
    variables: Array.isArray(input.variables)
      ? input.variables.map((variable) => ({
          name: variable.name,
          type: variable.type || 'number',
          initial: variable.initial ?? 0,
          kind: variable.kind || 'flag',
          label: variable.label,
          description: variable.description,
        }))
      : [],
    pages,
  };
}

export function defaultVariableValue(variable: NovelVariable): boolean | number | string {
  if (variable.initial !== undefined) return variable.initial;
  if (variable.type === 'bool') return false;
  if (variable.type === 'number') return 0;
  return '';
}
