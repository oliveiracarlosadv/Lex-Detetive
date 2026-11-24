'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeProvider } from 'next-themes';
import { Toaster, toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppShell } from './app-shell';
import { LogoMark } from './logo';

function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading, failed, refresh } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/setup');
  const { locked } = useAuth();
  // Bloqueado por senha → tela de desbloqueio.
  useEffect(() => { if (!isPublic && !loading && !user && locked) router.replace('/login/'); }, [isPublic, loading, user, locked, router]);
  if (isPublic) return <>{children}</>;
  if (failed && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <LogoMark className="size-14" />
        <p className="max-w-sm text-sm text-muted-foreground">O Lex Detetive não conseguiu abrir o banco de dados deste navegador. Verifique se o navegador não está em modo anônimo ou com o armazenamento de sites bloqueado.</p>
        <Button onClick={() => refresh()}><RefreshCw />Tentar de novo</Button>
      </div>
    );
  }
  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <LogoMark className="size-14" />
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}

/** Marca a página como oculta quando a janela é minimizada (pausa animações). */
function useHiddenClass() {
  useEffect(() => {
    const apply = () => document.documentElement.classList.toggle('app-oculto', document.hidden);
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => document.removeEventListener('visibilitychange', apply);
  }, []);
}

/** Liga o monitoramento automático, os resumos do Lex AI e o modo offline (uma vez por aba). */
function useLocalEngine() {
  useEffect(() => {
    (async () => {
      const [{ startMonitoring, setSummarizer }, { enqueueSummaries }] = await Promise.all([import('@/lib/local/monitoring'), import('@/lib/local/ai/service')]);
      setSummarizer(enqueueSummaries);
      startMonitoring();
    })();
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      // Atualizações: ao abrir (ou voltar ao app) procura versão nova; quando ela chega com o app aberto,
      // avisa e oferece "Atualizar agora". Fechando e abrindo, a versão nova já entra sozinha.
      const hadController = !!navigator.serviceWorker.controller;
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        toast.info('Nova versão do Lex Detetive disponível.', {
          duration: Infinity,
          action: { label: 'Atualizar agora', onClick: () => { reloading = true; location.reload(); } },
        });
      });
      navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/sw.js`, { updateViaCache: 'none' })
        .then((reg) => {
          const check = () => reg.update().catch(() => undefined);
          document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
          setInterval(check, 60 * 60 * 1000);
        })
        .catch(() => undefined);
    }
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useHiddenClass();
  useLocalEngine();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <Gate>{children}</Gate>
        <Toaster richColors position="top-right" closeButton />
      </AuthProvider>
    </ThemeProvider>
  );
}
