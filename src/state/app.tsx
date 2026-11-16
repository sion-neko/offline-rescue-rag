// アプリ全体の状態：モデルの読み込み、最近の検索、表示モード（ライト／夜）。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEngine } from '../ai/engine';
import { createStore } from '../rag/store';
import { ragIndex } from '../rag/rag';
import { log } from '../log';
import { dark, light, type Theme } from '../ui/theme';
import type { Engine } from '../ai/types';
import type { VectorStore } from '../rag/types';

export type ModelStatus = {
  /** 検索できる状態か（embedding とベクトル検索の準備ができた） */
  searchReady: boolean;
  /** AI のまとめを作れる状態か */
  llmReady: boolean;
  /** 読み込み中のモデルの進み具合（0〜1） */
  progress: number;
  /** 検索の準備に失敗した（目次と通報は使える） */
  searchError: string | null;
  /** AI の準備に失敗した（検索は使える） */
  llmError: string | null;
  searchReadyMs: number | null;
  llmReadyMs: number | null;
};

export type ThemeMode = 'system' | 'light' | 'dark';

type AppState = {
  engine: Engine;
  store: VectorStore;
  status: ModelStatus;
  recent: string[];
  addRecent: (q: string) => void;
  clearRecent: () => void;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  theme: Theme;
};

const engine = createEngine();
const store = createStore();
const Ctx = createContext<AppState | null>(null);

const RECENT_KEY = 'recent-searches';
const THEME_KEY = 'theme-mode';

async function readStorage(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeStorage(key: string, value: string) {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // 保存できなくても動作には影響しない
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ModelStatus>({
    searchReady: false,
    llmReady: false,
    progress: 0,
    searchError: null,
    llmError: null,
    searchReadyMs: null,
    llmReadyMs: null,
  });
  const [recent, setRecent] = useState<string[]>([]);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const scheme = useColorScheme();
  const started = useRef(false);

  useEffect(() => {
    readStorage(RECENT_KEY).then((v) => v && setRecent(JSON.parse(v)));
    readStorage(THEME_KEY).then((v) => v && setThemeModeState(v as ThemeMode));
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const t0 = Date.now();
      try {
        log(`engine=${engine.name} store=${store.name} chunks=${ragIndex.chunks.length}`);
        await store.init(ragIndex);
        await engine.loadEmbed((p) => setStatus((s) => ({ ...s, progress: p })));
        const searchReadyMs = Date.now() - t0;
        log(`検索の準備完了 ${searchReadyMs}ms`);
        setStatus((s) => ({ ...s, searchReady: true, progress: 0, searchReadyMs }));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log(`検索の準備エラー: ${message}`);
        setStatus((s) => ({ ...s, searchError: message }));
        return;
      }
      try {
        await engine.loadLlm((p) => setStatus((s) => ({ ...s, progress: p })));
        const llmReadyMs = Date.now() - t0;
        log(`LLM の準備完了 ${llmReadyMs}ms`);
        setStatus((s) => ({ ...s, llmReady: true, progress: 1, llmReadyMs }));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log(`LLM の準備エラー: ${message}`);
        setStatus((s) => ({ ...s, llmError: message }));
      }
    })();
  }, []);

  const addRecent = useCallback((q: string) => {
    setRecent((prev) => {
      const next = [q, ...prev.filter((x) => x !== q)].slice(0, 5);
      writeStorage(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    writeStorage(RECENT_KEY, '[]');
  }, []);

  const setThemeMode = useCallback((m: ThemeMode) => {
    setThemeModeState(m);
    writeStorage(THEME_KEY, m);
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && scheme === 'dark');
  const value = useMemo<AppState>(
    () => ({
      engine,
      store,
      status,
      recent,
      addRecent,
      clearRecent,
      themeMode,
      setThemeMode,
      theme: isDark ? dark : light,
    }),
    [status, recent, addRecent, clearRecent, themeMode, setThemeMode, isDark],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider の外で useApp が呼ばれました');
  return v;
}

export function useTheme() {
  return useApp().theme;
}
