import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  NovelAction,
  NovelCondition,
  NovelOption,
  NovelSource,
  NovelVariable,
  NovelViewState,
} from './schema';
import { defaultVariableValue, normalizeSource } from './schema';

export interface NovelTimerState {
  total: number;
  remaining: number;
  style: 'normal' | 'secret' | 'hidden';
  autoAdvance: boolean;
}

export interface NovelInventoryItem {
  name: string;
  label: string;
  description?: string;
  quantity: number | null;
}

export interface NovelView {
  pageId: string;
  title: string;
  images: string[];
  texts: Array<{ text: string; align?: 'left' | 'center' | 'right' }>;
  inventory: NovelInventoryItem[];
  timer: NovelTimerState | null;
  outletReady: boolean;
  outletKind: 'choice' | 'goto' | 'end' | 'none';
  gotoTarget: string | null;
  choiceActionId: string | null;
  options: Array<{ opt: NovelOption; locked: boolean; lockLabel?: string }>;
  variables: NovelViewState['variables'];
  totalPages: number;
  visitedCount: number;
}

function valueOf(value: unknown): boolean | number | string {
  if (typeof value !== 'string') return value as boolean | number | string;
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  const number = Number(trimmed);
  return trimmed !== '' && Number.isFinite(number) ? number : value;
}

function compareValues(left: unknown, compare: NovelCondition['compare'], right: unknown): boolean {
  const a = valueOf(left);
  const b = valueOf(right);
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    const boolA = typeof a === 'boolean' ? a : Boolean(a);
    const boolB = typeof b === 'boolean' ? b : Boolean(b);
    if (compare === '==') return boolA === boolB;
    if (compare === '!=') return boolA !== boolB;
    const numberA = boolA ? 1 : 0;
    const numberB = boolB ? 1 : 0;
    if (compare === '>') return numberA > numberB;
    if (compare === '>=') return numberA >= numberB;
    if (compare === '<') return numberA < numberB;
    if (compare === '<=') return numberA <= numberB;
    return false;
  }
  if (typeof a === 'number' || typeof b === 'number') {
    const numberA = Number(a);
    const numberB = Number(b);
    if (!Number.isNaN(numberA) && !Number.isNaN(numberB)) {
      if (compare === '==') return numberA === numberB;
      if (compare === '!=') return numberA !== numberB;
      if (compare === '>') return numberA > numberB;
      if (compare === '>=') return numberA >= numberB;
      if (compare === '<') return numberA < numberB;
      if (compare === '<=') return numberA <= numberB;
    }
  }
  const stringA = String(a ?? '');
  const stringB = String(b ?? '');
  if (compare === '==') return stringA === stringB;
  if (compare === '!=') return stringA !== stringB;
  if (compare === '>') return stringA > stringB;
  if (compare === '>=') return stringA >= stringB;
  if (compare === '<') return stringA < stringB;
  if (compare === '<=') return stringA <= stringB;
  return false;
}

function evaluateCondition(condition: NovelCondition | undefined, state: NovelViewState): boolean {
  if (!condition || condition.op === 'true') return true;
  if (condition.op === 'visited') return state.visited.includes(condition.page || '');
  if (condition.op === 'var') {
    return compareValues(state.variables[condition.variable || ''], condition.compare || '==', condition.value);
  }
  if (condition.op === 'and') return (condition.items || []).every((item) => evaluateCondition(item, state));
  if (condition.op === 'or') return (condition.items || []).some((item) => evaluateCondition(item, state));
  if (condition.op === 'not') return !evaluateCondition(condition.item, state);
  return true;
}

function truthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return typeof value === 'string' && value.trim() !== '' && value !== 'false';
}

function cloneState(state: NovelViewState): NovelViewState {
  return {
    pageId: state.pageId,
    variables: { ...state.variables },
    visited: [...state.visited],
    chosen: [...state.chosen],
  };
}

function storageKeys(slug: string): string[] {
  return [`webnovel:${slug}`, `webnovel-progress-${slug}`];
}

function actionId(type: string): string {
  return `${type}-${crypto.randomUUID().slice(0, 8)}`;
}

export function useNovelEngine(slug: string, rawSource: unknown) {
  const [source, setSource] = useState<NovelSource | null>(null);
  const [state, setState] = useState<NovelViewState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [timer, setTimer] = useState<NovelTimerState | null>(null);
  const [outletReady, setOutletReady] = useState(false);
  const [acquired, setAcquired] = useState<NovelInventoryItem[]>([]);
  const hydratedSlug = useRef('');
  const previousItems = useRef<Set<string> | null>(null);

  const getPage = useCallback((pageId: string) => source?.pages.find((page) => page.id === pageId), [source]);

  const applySet = useCallback((current: NovelViewState, action: NovelAction): NovelViewState => {
    if (action.type !== 'set' || !action.variable) return current;
    const next = cloneState(current);
    const old = next.variables[action.variable];
    if (action.op === 'add') {
      const result = Number(old || 0) + Number(action.value || 0);
      next.variables[action.variable] = Number.isFinite(result) ? result : Number(old || 0);
    } else {
      next.variables[action.variable] = action.value ?? '';
    }
    return next;
  }, []);

  const enterPage = useCallback((current: NovelViewState, pageId: string): NovelViewState => {
    const page = source?.pages.find((item) => item.id === pageId);
    if (!page) return current;
    let next = cloneState(current);
    next.pageId = pageId;
    if (!next.visited.includes(pageId)) next.visited.push(pageId);
    for (const action of page.actions || []) {
      if (!action.disabled && action.type === 'set') next = applySet(next, action);
    }
    return next;
  }, [applySet, source]);

  useEffect(() => {
    if (!rawSource || hydratedSlug.current === slug) return;
    hydratedSlug.current = slug;
    const nextSource = normalizeSource(rawSource);
    setSource(nextSource);
    let saved: Partial<NovelViewState> | null = null;
    try {
      for (const key of storageKeys(slug)) {
        const value = localStorage.getItem(key);
        if (value) { saved = JSON.parse(value) as Partial<NovelViewState>; break; }
      }
    } catch { saved = null; }
    const variables: NovelViewState['variables'] = {};
    for (const variable of nextSource.variables) variables[variable.name] = defaultVariableValue(variable);
    let initial: NovelViewState = {
      pageId: nextSource.startPage,
      variables: { ...variables, ...(saved?.variables || {}) },
      visited: Array.isArray(saved?.visited) ? saved.visited : [],
      chosen: Array.isArray(saved?.chosen) ? saved.chosen : [],
    };
    if (!nextSource.pages.some((page) => page.id === initial.pageId)) initial.pageId = nextSource.pages[0]?.id || '';
    if (initial.pageId) {
      const pageExists = nextSource.pages.some((page) => page.id === saved?.pageId);
      initial.pageId = pageExists ? String(saved?.pageId) : nextSource.startPage;
    }
    setState(initial);
    setLoaded(true);
  }, [rawSource, slug]);

  useEffect(() => {
    if (!state) return;
    try { localStorage.setItem(storageKeys(slug)[0], JSON.stringify(state)); } catch {}
  }, [slug, state]);

  const currentPage = state ? getPage(state.pageId) : undefined;

  useEffect(() => {
    if (!source || !state || !currentPage) return;
    const timerAction = currentPage.actions.find((action) => !action.disabled && action.type === 'timer');
    if (!timerAction?.duration) { setTimer(null); setOutletReady(true); return; }
    const duration = timerAction.duration;
    const total = duration.mode === 'specific'
      ? Math.max(1, Math.round(duration.seconds || 1))
      : (() => {
          const min = Math.max(1, Math.round(duration.min || 1));
          const max = Math.max(min, Math.round(duration.max || min));
          return min + Math.round(Math.random() * (max - min));
        })();
    const autoAdvance = Boolean(timerAction.autoAdvance);
    setTimer({ total, remaining: total, style: timerAction.style || 'normal', autoAdvance });
    setOutletReady(false);
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      if (elapsed >= total) {
        clearInterval(interval);
        setTimer({ total, remaining: 0, style: timerAction.style || 'normal', autoAdvance });
        setOutletReady(true);
      } else {
        setTimer((current) => current && { ...current, remaining: Math.max(0, total - elapsed) });
      }
    }, 200);
    return () => clearInterval(interval);
  }, [currentPage, source, state?.pageId]);

  useEffect(() => {
    if (!state || !source) return;
    const items = new Set(source.variables.filter((variable) => variable.kind === 'item' && truthy(state.variables[variable.name])).map((variable) => variable.name));
    if (!previousItems.current) { previousItems.current = items; return; }
    const added = [...items].filter((name) => !previousItems.current?.has(name));
    if (added.length) {
      setAcquired(added.map((name) => {
        const variable = source.variables.find((item) => item.name === name) as NovelVariable;
        return { name, label: variable.label?.trim() || name, description: variable.description, quantity: variable.type === 'number' ? Number(state.variables[name]) || 0 : null };
      }));
    }
    previousItems.current = items;
  }, [source, state]);

  const pickOption = useCallback((choiceActionId: string, optionId: string) => {
    if (!source || !state) return;
    const page = source.pages.find((item) => item.id === state.pageId);
    const choice = page?.actions.find((action) => !action.disabled && action.id === choiceActionId && action.type === 'choice');
    const option = choice?.options?.find((item) => item.id === optionId);
    if (!choice || choice.type !== 'choice' || !option) return;
    if (!evaluateCondition(option.visible, state) || !evaluateCondition(option.locked, state)) return;
    let next = cloneState(state);
    next.chosen = next.chosen.includes(option.id) ? next.chosen : [...next.chosen, option.id];
    for (const action of option.actions || []) {
      if (action.disabled) continue;
      if (action.type === 'set') next = applySet(next, action);
      if (action.type === 'goto' && action.target) next = enterPage(next, action.target);
    }
    if (option.goto) next = enterPage(next, option.goto);
    setState(next);
  }, [applySet, enterPage, source, state]);

  const continueGoto = useCallback((target: string) => {
    if (!state) return;
    setState(enterPage(state, target));
  }, [enterPage, state]);

  const restart = useCallback(() => {
    if (!source) return;
    previousItems.current = new Set();
    try { localStorage.removeItem(storageKeys(slug)[0]); } catch {}
    const variables: NovelViewState['variables'] = {};
    for (const variable of source.variables) variables[variable.name] = defaultVariableValue(variable);
    setState(enterPage({ pageId: source.startPage, variables, visited: [], chosen: [] }, source.startPage));
  }, [enterPage, slug, source]);

  let view: NovelView | null = null;
  if (source && state && currentPage) {
    const images: string[] = [];
    const texts: NovelView['texts'] = [];
    for (const action of currentPage.actions || []) {
      if (action.disabled) continue;
      if (action.type === 'image' && action.image) images.push(action.image);
      if (action.type === 'say' && action.text) texts.push({ text: action.text, align: action.align });
    }
    const choiceActions = currentPage.actions.filter((action) => !action.disabled && action.type === 'choice');
    // 出口判定：有分支 → choice；有跳转 → goto；两者都没有 → 本页就是结局（end）。
    // 旧格式小说的结局页只有文字没有 end 动作，也必须按结局处理，否则按钮区会掉进兜底分支。
    let outletKind: NovelView['outletKind'] = 'end';
    let gotoTarget: string | null = null;
    if (choiceActions.length) outletKind = 'choice';
    else {
      const goto = currentPage.actions.find((action) => !action.disabled && action.type === 'goto');
      if (goto?.target) { outletKind = 'goto'; gotoTarget = goto.target; }
    }
    const options: NovelView['options'] = [];
    for (const action of choiceActions) {
      for (const option of action.options || []) {
        if (evaluateCondition(option.visible, state)) {
          const locked = Boolean(option.locked && !evaluateCondition(option.locked, state));
          options.push({ opt: option, locked, lockLabel: option.lockLabel || '未满足条件' });
        }
      }
    }
    const inventory = source.variables
      .filter((variable) => variable.kind === 'item' && truthy(state.variables[variable.name]))
      .map((variable) => ({
        name: variable.name,
        label: variable.label?.trim() || variable.name,
        description: variable.description,
        quantity: variable.type === 'number' ? Number(state.variables[variable.name]) || 0 : null,
      }));
    view = {
      pageId: state.pageId,
      title: currentPage.title || '',
      images,
      texts,
      inventory,
      timer,
      outletReady,
      outletKind,
      gotoTarget,
      choiceActionId: choiceActions[0]?.id || null,
      options,
      variables: state.variables,
      totalPages: source.pages.length,
      visitedCount: state.visited.length,
    };
  }

  return { state, loaded, view, pickOption, continueGoto, restart, acquired, dismissAcquired: () => setAcquired([]) };
}

export function conditionResult(condition: NovelCondition | undefined, state: NovelViewState): boolean {
  return evaluateCondition(condition, state);
}

export function createAction(type: NovelAction['type']): NovelAction {
  const base = { id: actionId(type), type } as NovelAction;
  if (type === 'say') return { ...base, text: '', align: 'left' };
  if (type === 'image') return { ...base, image: '' };
  if (type === 'timer') return { ...base, duration: { mode: 'specific', seconds: 5 }, style: 'normal' };
  if (type === 'choice') return { ...base, options: [{ id: actionId('option-'), label: '' }] };
  if (type === 'set') return { ...base, variable: '', op: 'set', value: '' };
  if (type === 'goto') return { ...base, target: '' };
  return base;
}
