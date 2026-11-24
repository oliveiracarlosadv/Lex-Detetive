'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from './api';

/** Na versão web não há contas: o "usuário" é o perfil deste navegador (nome, foto, escritório). */
export interface User {
  id: string; name: string; email: string; role: 'admin' | 'analista' | 'leitor'; totpEnabled: boolean; photo?: string | null;
  office?: string | null; activity?: string | null; registryType?: string | null; registryNumber?: string | null; registryUf?: string | null; hasLogo?: boolean;
}
interface AuthState {
  user: User | null; loading: boolean; failed: boolean; locked: boolean; hasPassword: boolean;
  refresh: () => Promise<void>; signIn: (token: string, user: User) => void; signOut: () => void;
}

const Ctx = createContext<AuthState>(null as any);
export const useAuth = () => useContext(Ctx);
const PUBLIC = ['/login', '/setup'];
const UNLOCK_KEY = 'lex.desbloqueado';
const unlocked = () => { try { return sessionStorage.getItem(UNLOCK_KEY) === '1'; } catch { return false; } };
const setUnlocked = (v: boolean) => { try { v ? sessionStorage.setItem(UNLOCK_KEY, '1') : sessionStorage.removeItem(UNLOCK_KEY); } catch { /* sem storage */ } };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    setFailed(false);
    try {
      const status = await api<{ needsSetup: boolean }>('/auth/status');
      // Primeiro uso: boas-vindas explicando o app e o nome/foto de quem usa.
      if (status.needsSetup) { setUser(null); if (!pathname.startsWith('/setup')) router.replace('/setup/'); return; }
      const lock = await api<{ hasPassword: boolean }>('/auth/lock');
      setHasPassword(lock.hasPassword);
      if (lock.hasPassword && !unlocked()) { setUser(null); setLocked(true); if (!pathname.startsWith('/login')) router.replace('/login/'); return; }
      setLocked(false);
      setUser(await api<User>('/auth/me'));
    } catch {
      setUser(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = (_token: string, u: User) => { setUnlocked(true); setLocked(false); setUser(u); router.replace('/'); };
  /** "Bloquear": só faz sentido com senha; sem senha, apenas recarrega o perfil. */
  const signOut = () => {
    if (!hasPassword) { refresh(); return; }
    setUnlocked(false); setUser(null); setLocked(true); router.replace('/login/');
  };

  return <Ctx.Provider value={{ user, loading, failed, locked, hasPassword, refresh, signIn, signOut }}>{children}</Ctx.Provider>;
}

export { PUBLIC };
