/**
 * 交互小说游玩引擎（客户端）。
 * 复刻 2x.nz webnovel 的引擎逻辑：条件系统 + 变量 + 选项 + 进度保存（localStorage）。
 */
import { useEffect, useRef, useState } from 'react';
import type { NovelContent, NovelPage, Condition } from './api';

export interface PlayState {
  pageId: string;
  variables: Record<string, number>;
  visited: string[];
  chosen: string[];
}

/** 条件求值 */
function evalCondition(cond: Condition | undefined, state: PlayState): boolean {
  if (!cond) return true;
  switch (cond.op) {
    case 'true': return true;
    case 'visited': return state.visited.includes(String(cond.page || ''));
    case 'var': {
      const cur = state.variables[String(cond.variable || '')] ?? 0;
      const target = Number(cond.value ?? 0);
      switch (cond.compare) {
        case '>': return cur > target;
        case '>=': return cur >= target;
        case '<': return cur < target;
        case '<=': return cur <= target;
        case '!=': return cur !== target;
        default: return cur === target;
      }
    }
    case 'and': return (cond.items || []).every((i) => evalCondition(i, state));
    case 'or': return (cond.items || []).some((i) => evalCondition(i, state));
    case 'not': return !evalCondition(cond.item, state);
    default: return true;
  }
}

/** 应用动作（set/goto） */
function applyActions(state: PlayState, page: NovelPage, choiceId: string): PlayState {
  const choice = page.choices.find((ch) => ch.id === choiceId);
  if (!choice) return state;
  let next = {
    ...state,
    chosen: state.chosen.includes(choiceId) ? state.chosen : [...state.chosen, choiceId],
  };
  for (const action of choice.actions || []) {
    if (action.type === 'set' && action.variable) {
      const cur = next.variables[action.variable] ?? 0;
      const val = Number(action.value ?? 0);
      const variables = { ...next.variables };
      if (action.op === '+') variables[action.variable] = cur + val;
      else if (action.op === '-') variables[action.variable] = cur - val;
      else variables[action.variable] = val;
      next = { ...next, variables };
    } else if (action.type === 'goto' && action.target && next.pageId !== action.target) {
      next = enterPage(next, action.target, action.target !== page.id);
    }
  }
  return next;
}

function enterPage(state: PlayState, pageId: string, markVisited = true): PlayState {
  return {
    ...state,
    pageId,
    visited: markVisited && !state.visited.includes(pageId) ? [...state.visited, pageId] : state.visited,
  };
}

function storageKey(slug: string): string {
  return `webnovel-progress-${slug}`;
}

export function useNovelEngine(slug: string, content: NovelContent | undefined) {
  const [state, setState] = useState<PlayState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const hydrated = useRef(false);

  const engine = useRef({
    pages: content?.pages || [],
    variables: content?.variables || [],
    startPage: content?.startPage || content?.pages?.[0]?.id || '',
  });

  useEffect(() => {
    engine.current = {
      pages: content?.pages || [],
      variables: content?.variables || [],
      startPage: content?.startPage || content?.pages?.[0]?.id || '',
    };
  }, [content]);

  // 初始化 / 恢复进度
  useEffect(() => {
    if (!content || hydrated.current) return;
    hydrated.current = true;
    try {
      const saved = localStorage.getItem(storageKey(slug));
      if (saved) {
        const parsed = JSON.parse(saved);
        // 校验保存的页是否存在
        if (parsed.pageId && engine.current.pages.some((p) => p.id === parsed.pageId)) {
          const variables: Record<string, number> = {};
          for (const v of engine.current.variables) variables[v.name] = Number(v.initial ?? 0);
          setState({
            ...parsed,
            variables: { ...variables, ...(parsed.variables || {}) },
          });
          setLoaded(true);
          return;
        }
      }
    } catch {}
    // 新开始
    const variables: Record<string, number> = {};
    for (const v of engine.current.variables) variables[v.name] = Number(v.initial ?? 0);
    setState({ pageId: engine.current.startPage, variables, visited: [], chosen: [] });
    setLoaded(true);
  }, [content, slug]);

  // 保存进度
  useEffect(() => {
    if (!state) return;
    try { localStorage.setItem(storageKey(slug), JSON.stringify(state)); } catch {}
  }, [state, slug]);

  const currentPage: NovelPage | undefined = state
    ? engine.current.pages.find((p) => p.id === state.pageId)
    : undefined;

  const visibleChoices = state && currentPage
    ? currentPage.choices.filter((ch) => evalCondition(ch.condition, state))
    : [];

  const choose = (choiceId: string) => {
    if (!state || !currentPage) return;
    setState((prev) => (prev ? applyActions(prev, currentPage, choiceId) : prev));
  };

  const restart = () => {
    const variables: Record<string, number> = {};
    for (const v of engine.current.variables) variables[v.name] = Number(v.initial ?? 0);
    setState({ pageId: engine.current.startPage, variables, visited: [], chosen: [] });
  };

  return { state, loaded, currentPage, visibleChoices, choose, restart };
}
