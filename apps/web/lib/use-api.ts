'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Busca dados da API com estado de carregamento/erro e recarga manual. */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!path) return;
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    if (!silent) setLoading(true);
    try {
      setData(await api<T>(path, { signal: ctrl.current.signal }));
      setError(null);
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { load(); return () => ctrl.current?.abort(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  // O monitoramento automático gravou novidades: atualiza a tela sem piscar.
  useEffect(() => {
    const on = () => load(true);
    window.addEventListener('lex:dados-atualizados', on);
    return () => window.removeEventListener('lex:dados-atualizados', on);
  }, [load]);
  return { data, error, loading, reload: load, setData };
}
