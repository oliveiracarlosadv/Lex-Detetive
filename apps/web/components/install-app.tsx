'use client';
import { useEffect, useState } from 'react';
import { Download, MoreVertical, PlusSquare, Share, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog } from './ui/misc';
import { cn } from '@/lib/utils';

type Platform = 'ios' | 'android' | 'desktop';

/** Evento que Chrome/Edge/Android disparam quando o app pode ser instalado com um clique. */
let deferred: any = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; listeners.forEach((l) => l()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()); });
}

function detect(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
export const isInstalled = () => typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span><span className="pt-0.5 text-sm">{children}</span></li>;
}

/** Instruções objetivas, já abertas na aba do aparelho em uso. */
export function InstallSteps() {
  const [tab, setTab] = useState<Platform>('android');
  const [canPrompt, setCanPrompt] = useState(false);
  useEffect(() => {
    setTab(detect());
    const update = () => setCanPrompt(!!deferred);
    update(); listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  const install = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => null); deferred = null; setCanPrompt(false); };

  if (isInstalled()) return <p className="rounded-lg bg-success/10 p-3 text-sm">O Lex Detetive já está instalado neste aparelho.</p>;
  return (
    <div className="space-y-3">
      {canPrompt && <Button className="w-full" onClick={install}><Download />Instalar agora</Button>}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-xs">
        {([['ios', 'iPhone/iPad'], ['android', 'Android'], ['desktop', 'Computador']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn('rounded-md py-1.5 cursor-pointer', tab === k ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground')}>{l}</button>
        ))}
      </div>
      <ol className="space-y-2.5">
        {tab === 'ios' && <>
          <Step n={1}>Abra este site no <b>Safari</b>.</Step>
          <Step n={2}>Toque em <b>Compartilhar</b> <Share className="inline size-4 align-text-bottom" /> (barra de baixo).</Step>
          <Step n={3}>Toque em <b>Adicionar à Tela de Início</b> <PlusSquare className="inline size-4 align-text-bottom" />.</Step>
          <Step n={4}>Toque em <b>Adicionar</b>. O ícone do Lex Detetive aparece na tela inicial.</Step>
        </>}
        {tab === 'android' && <>
          <Step n={1}>Abra este site no <b>Chrome</b>.</Step>
          <Step n={2}>Toque no menu <MoreVertical className="inline size-4 align-text-bottom" /> (canto superior direito).</Step>
          <Step n={3}>Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</Step>
          <Step n={4}>Confirme em <b>Instalar</b>. O ícone aparece na tela inicial.</Step>
        </>}
        {tab === 'desktop' && <>
          <Step n={1}>Abra este site no <b>Chrome</b> ou no <b>Edge</b>.</Step>
          <Step n={2}>Clique no ícone de instalar <Download className="inline size-4 align-text-bottom" /> no fim da barra de endereço.</Step>
          <Step n={3}>Clique em <b>Instalar</b>. O app abre em janela própria e fica no menu de aplicativos.</Step>
          <Step n={4}>No Safari do Mac: menu <b>Arquivo → Adicionar ao Dock</b>.</Step>
        </>}
      </ol>
      <p className="text-xs text-muted-foreground">Os dados ficam no navegador onde o app foi instalado. Para levar para outro aparelho, use Configurações → Backup (exportar e importar).</p>
    </div>
  );
}

/** Botão do menu: "Instalar no celular". */
export function InstallButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => setInstalled(isInstalled()), []);
  if (installed) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={cn('flex w-full items-center gap-2 rounded-xl bg-gold px-3 py-2.5 text-sm font-semibold text-navy shadow hover:brightness-105 cursor-pointer', className)}>
        <Smartphone className="size-4" /> Instalar no celular
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Instalar o Lex Detetive" description="Use como aplicativo, com ícone na tela inicial e em tela cheia.">
        <InstallSteps />
      </Dialog>
    </>
  );
}
