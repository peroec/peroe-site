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

export interface ImportedNovel {
  title: string;
  description: string;
  tags: string[];
  source: NovelSource;
  warnings: string[];
}

function importId(prefix: string, used: Set<string>): string {
  let id = `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  while (used.has(id)) id = `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  used.add(id);
  return id;
}

/**
 * 规范化外部 JSON。线上格式使用 source，历史格式使用 content，二者都接受。
 * 导入不阻断：缺失 id、重复 id、悬空跳转会被修正，并返回体检提示。
 */
export function normalizeImportedNovel(raw: unknown): ImportedNovel {
  const input = raw && typeof raw === 'object' ? raw as Record<string, any> : {};
  const sourceInput = (input.source || input.content || input) as Partial<NovelSource>;
  const warnings: string[] = [];
  const usedPageIds = new Set<string>();
  const rawPages = Array.isArray(sourceInput.pages) ? sourceInput.pages : [];
  const pageIds = rawPages.map((page, index) => {
    const original = typeof page?.id === 'string' && page.id.trim() ? page.id.trim() : '';
    const id = original && !usedPageIds.has(original) ? (usedPageIds.add(original), original) : importId('page', usedPageIds);
    if (!original) warnings.push(`第 ${index + 1} 页缺少 id，已生成 ${id}`);
    else if (original !== id) warnings.push(`页面 id「${original}」重复，已改为 ${id}`);
    return id;
  });
  const validPageIds = new Set(pageIds);
  const usedActionIds = new Set<string>();
  const usedOptionIds = new Set<string>();
  const danglingTargets: Array<{ pageIndex: number; actionIndex: number; optionIndex?: number }> = [];
  const pages: NovelPage[] = rawPages.map((rawPage: any, pageIndex) => {
    const pageId = pageIds[pageIndex];
    const rawActions = Array.isArray(rawPage?.actions) ? rawPage.actions : [];
    const actions: NovelAction[] = rawActions.map((rawAction: any, actionIndex: number) => {
      const actionId = typeof rawAction?.id === 'string' && rawAction.id.trim() && !usedActionIds.has(rawAction.id)
        ? (usedActionIds.add(rawAction.id), rawAction.id)
        : importId('a', usedActionIds);
      if (!rawAction?.id) warnings.push(`页面 ${pageId} 的第 ${actionIndex + 1} 个动作缺少 id，已生成 ${actionId}`);
      const action = { ...rawAction, id: actionId } as NovelAction;
      if (action.type === 'goto') {
        if (!validPageIds.has(action.target || '')) danglingTargets.push({ pageIndex, actionIndex });
      } else if (action.type === 'choice') {
        action.options = (Array.isArray(action.options) ? action.options : []).map((rawOption: any, optionIndex) => {
          const optionId = typeof rawOption?.id === 'string' && rawOption.id.trim() && !usedOptionIds.has(rawOption.id)
            ? (usedOptionIds.add(rawOption.id), rawOption.id)
            : importId('o', usedOptionIds);
          if (!rawOption?.id) warnings.push(`页面 ${pageId} 的第 ${optionIndex + 1} 个选项缺少 id，已生成 ${optionId}`);
          if (rawOption?.goto && !validPageIds.has(rawOption.goto)) danglingTargets.push({ pageIndex, actionIndex, optionIndex });
          return { ...rawOption, id: optionId };
        });
      }
      return action;
    });
    return { ...rawPage, id: pageId, title: rawPage?.title || pageId, actions };
  });

  if (danglingTargets.length) {
    const endId = importId('import_end', usedPageIds);
    pages.push({ id: endId, title: '导入修复后的结局', actions: [{ id: importId('a', usedActionIds), type: 'end' }] });
    for (const target of danglingTargets) {
      const action = pages[target.pageIndex].actions[target.actionIndex];
      if (target.optionIndex === undefined) (action as NovelAction & { target?: string }).target = endId;
      else if (action.type === 'choice') action.options![target.optionIndex].goto = endId;
    }
    warnings.push(`发现 ${danglingTargets.length} 个悬空跳转，已统一指向「${endId}」`);
  }

  const startPage = validPageIds.has(String(sourceInput.startPage)) ? String(sourceInput.startPage) : pages[0]?.id || 'start';
  if (sourceInput.startPage !== startPage) warnings.push(`startPage 不存在，已改为「${startPage}」`);
  const usedVariableNames = new Set<string>();
  const variables: NovelVariable[] = Array.isArray(sourceInput.variables) ? sourceInput.variables.map((variable: any, index: number): NovelVariable => {
    const raw = typeof variable?.name === 'string' ? variable.name.trim() : '';
    const name = raw && !usedVariableNames.has(raw) ? (usedVariableNames.add(raw), raw) : importId('variable', usedVariableNames);
    if (!raw) warnings.push(`第 ${index + 1} 个变量缺少 name，已生成 ${name}`);
    else if (raw !== name) warnings.push(`变量名「${raw}」重复，已改为 ${name}`);
    return {
      name,
      type: variable?.type === 'bool' || variable?.type === 'string' ? variable.type : 'number',
      initial: variable?.initial ?? (variable?.type === 'bool' ? false : variable?.type === 'string' ? '' : 0),
      kind: variable?.kind === 'item' ? 'item' : 'flag',
      label: variable?.label,
      description: variable?.description,
    };
  }) : [];
  if (!pages.length) warnings.push('没有页面，已使用空白开始页');
  return {
    title: String(input.title || '未命名作品'),
    description: String(input.description || ''),
    tags: Array.isArray(input.tags) ? input.tags.map(String).filter(Boolean).slice(0, 12) : [],
    source: pages.length ? { startPage, variables, pages } : createStarterSource(),
    warnings,
  };
}

/** 递归收集条件表达式里引用的变量名 */
function collectConditionVars(condition: NovelCondition | undefined, out: Set<string> = new Set()): Set<string> {
  if (!condition) return out;
  if (condition.op === 'var' && condition.variable) out.add(condition.variable);
  if (condition.items) for (const item of condition.items) collectConditionVars(item, out);
  if (condition.item) collectConditionVars(condition.item, out);
  return out;
}

/**
 * 可玩性体检（与 format 页「导入前的体检」11 项保持一致）。
 * 不拦导入，只把问题列给用户。
 */
export function auditNovelSource(source: NovelSource): string[] {
  const issues: string[] = [];
  const pages = source.pages;
  const pageSet = new Set(pages.map((page) => page.id));
  if (!pages.length) return ['没有页面'];
  if (!pageSet.has(source.startPage)) issues.push(`起始页「${source.startPage}」不存在`);
  const variables = new Map(source.variables.map((variable) => [variable.name, variable]));
  const assignedVars = new Set<string>();
  const exitsOf = new Map<string, string[]>();

  for (const page of pages) {
    const title = page.title?.trim();
    if (!title || title === page.id) issues.push(`NO_TITLE：页面「${page.id}」缺中文 title`);
    const choices = page.actions.filter((action) => action.type === 'choice');
    const hasGoto = page.actions.some((action) => action.type === 'goto' && action.target);
    const hasEnd = page.actions.some((action) => action.type === 'end');
    if (!choices.length && !hasGoto && !hasEnd) issues.push(`NO_EXIT：页面「${page.id}」没有出口`);
    const targets: string[] = [];
    for (const action of page.actions) {
      if (action.type === 'goto' && action.target) {
        targets.push(action.target);
        if (!pageSet.has(action.target)) issues.push(`页面「${page.id}」跳转到不存在的「${action.target}」`);
      }
      if (action.type === 'set' && action.variable) {
        assignedVars.add(action.variable);
        if (!variables.has(action.variable)) issues.push(`UNDECLARED_VAR：set 引用未声明的变量「${action.variable}」`);
      }
      if (action.type !== 'choice') continue;
      for (const option of action.options || []) {
        if (option.goto) {
          targets.push(option.goto);
          if (!pageSet.has(option.goto)) issues.push(`选项「${option.label}」跳转到不存在的「${option.goto}」`);
        }
        for (const condition of [option.visible, option.locked]) {
          if (!condition) continue;
          for (const name of collectConditionVars(condition)) {
            const variable = variables.get(name);
            if (!variable) issues.push(`UNDECLARED_VAR：条件引用了未声明的变量「${name}」`);
            else if (variable.kind === 'flag') issues.push(`INVISIBLE_GATE_STATE：门槛条件引用了隐藏变量「${name}」，应改为 kind:"item" 道具`);
          }
          for (const cond of collectVisitedPages(condition)) {
            if (!pageSet.has(cond)) issues.push(`条件 visited 引用了不存在的页面「${cond}」`);
          }
        }
        for (const action of option.actions || []) {
          if (action.type === 'set' && action.variable) {
            assignedVars.add(action.variable);
            if (!variables.has(action.variable)) issues.push(`UNDECLARED_VAR：set 引用未声明的变量「${action.variable}」`);
          }
        }
      }
    }
    exitsOf.set(page.id, targets);
    if (choices.length && !hasGoto && !hasEnd) {
      const allConditional = choices.every((action) => (action.options || []).length > 0 && (action.options || []).every((option) => option.visible || option.locked));
      if (allConditional) issues.push(`ALL_CONDITIONAL：页面「${page.id}」所有选项都带条件，条件不满足时无路可走`);
    }
  }
  for (const [name, variable] of variables) {
    if (!assignedVars.has(name)) issues.push(`NEVER_ASSIGNED：变量「${name}」从未被任何 set 赋值`);
    if (variable.kind === 'item' && !variable.label?.trim()) issues.push(`ITEM_NO_LABEL：道具「${name}」缺 label，背包里会显示英文标识`);
  }
  const reachable = new Set<string>();
  const queue = [source.startPage];
  while (queue.length) {
    const id = queue.shift() as string;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const target of exitsOf.get(id) || []) if (pageSet.has(target)) queue.push(target);
  }
  for (const page of pages) if (!reachable.has(page.id)) issues.push(`UNREACHABLE：页面「${page.id}」从起点不可达`);
  return [...new Set(issues)];
}

/** 递归收集条件表达式里 visited 引用的页面 id */
function collectVisitedPages(condition: NovelCondition | undefined, out: string[] = []): string[] {
  if (!condition) return out;
  if (condition.op === 'visited' && condition.page) out.push(condition.page);
  if (condition.items) for (const item of condition.items) collectVisitedPages(item, out);
  if (condition.item) collectVisitedPages(condition.item, out);
  return out;
}
