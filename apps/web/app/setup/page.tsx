'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, Camera, Contact, Database, FileText, HardDrive, Radar, Search, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { LogoMark } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { initials, shrinkImage } from '@/lib/image';
import { cn } from '@/lib/utils';
import { InstallSteps } from '@/components/install-app';

/** Primeiro uso: apresentação rápida de como o app funciona e o perfil de quem usa. */
const SLIDES = [
  {
    icon: Sparkles, title: 'Bem-vindo ao Lex Detetive',
    text: 'Pesquisa e monitoramento jurídico: processos, intimações, diários oficiais, dados de empresas e redes sociais de pessoas e empresas, em um só lugar.',
    items: [[Search, 'Pesquise por nome, CPF, CNPJ, OAB ou número do processo'], [Radar, 'Monitore e receba alertas de novidades'], [FileText, 'Gere relatórios prontos para o cliente']],
  },
  {
    icon: HardDrive, title: 'Tudo fica no seu aparelho',
    text: 'Não há conta nem servidor: os dados ficam guardados neste navegador e não são enviados para a Lex Tecnologias.',
    items: [[ShieldCheck, 'Só você vê os dados, neste aparelho'], [Database, 'Faça backup em Configurações → Backup (exportar e importar)'], [Bell, 'Se apagar os dados do navegador, os dados do app também somem']],
  },
  {
    icon: Radar, title: 'Como funciona',
    text: 'As consultas vão direto do seu navegador às fontes públicas oficiais.',
    items: [
      [Search, 'Automático: DJEN (intimações dos tribunais), diários municipais, CNPJ, GitHub e Bluesky'],
      [FileText, 'Links prontos: Diário Oficial da União, diários estaduais, Portal da Transparência e buscadores (Google, Bing…)'],
      [Radar, 'O monitoramento verifica enquanto o app estiver aberto (aba ou app instalado)'],
      [Contact, 'Clientes, alertas e relatórios funcionam como antes'],
    ],
  },
] as const;

export default function SetupPage() {
  const { signIn } = useAuth();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: '', office: '', photo: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const total = SLIDES.length + 2; // + instalar + perfil

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setF({ ...f, photo: await shrinkImage(file, 256, true) });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.name.trim().split(/\s+/).length < 2) return setError('Informe nome e sobrenome.');
    setLoading(true); setError('');
    try {
      const r = await api('/auth/setup', { method: 'POST', body: f });
      // Pede ao navegador para não apagar os dados sozinho quando faltar espaço.
      await navigator.storage?.persist?.().catch(() => false);
      signIn(r.token, r.user);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const slide = SLIDES[step] as (typeof SLIDES)[number] | undefined;
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-navy p-4 text-white">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3"><LogoMark className="size-12" /><div><div className="text-xl font-semibold">Lex Detetive</div><div className="text-[10px] tracking-[0.25em] text-gold">LEX TECNOLOGIAS</div></div></div>
        <div className="rounded-2xl bg-card p-6 text-foreground shadow-xl">
          {slide ? (
            <>
              <slide.icon className="mb-3 size-8 text-gold" />
              <h1 className="text-xl font-semibold">{slide.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{slide.text}</p>
              <ul className="mt-4 space-y-3">
                {slide.items.map(([Icon, t]) => <li key={t as string} className="flex gap-3 text-sm"><Icon className="mt-0.5 size-4 shrink-0 text-primary" />{t as string}</li>)}
              </ul>
            </>
          ) : step === SLIDES.length ? (
            <>
              <Smartphone className="mb-3 size-8 text-gold" />
              <h1 className="text-xl font-semibold">Use como aplicativo</h1>
              <p className="mt-2 mb-4 text-sm text-muted-foreground">Instale na tela inicial do celular ou do computador: abre em tela cheia e funciona como um app. Dá para fazer depois pelo botão <b>Instalar no celular</b> do menu.</p>
              <InstallSteps />
            </>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h1 className="text-xl font-semibold">Seu perfil</h1>
              <p className="text-sm text-muted-foreground">Aparece no menu e na assinatura dos relatórios.</p>
              <label className="mx-auto flex w-fit cursor-pointer flex-col items-center gap-2">
                {f.photo ? <img src={f.photo} alt="Sua foto" className="size-20 rounded-full object-cover" /> :
                  <span className="flex size-20 items-center justify-center rounded-full bg-muted text-xl font-semibold text-muted-foreground">{initials(f.name) || <Camera className="size-6" />}</span>}
                <span className="text-xs text-primary">{f.photo ? 'Trocar foto' : 'Adicionar foto (opcional)'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={pick} />
              </label>
              <Field label="Nome completo"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus autoComplete="name" /></Field>
              <Field label="Escritório (opcional)"><Input value={f.office} onChange={(e) => setF({ ...f, office: e.target.value })} /></Field>
              {error && <p className="text-sm text-danger" role="alert">{error}</p>}
              <Button className="w-full" loading={loading}>Começar a usar</Button>
            </form>
          )}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft />Voltar</Button>
            <div className="flex gap-1.5">{Array.from({ length: total }, (_, i) => <span key={i} className={cn('size-1.5 rounded-full', i === step ? 'bg-primary' : 'bg-muted')} />)}</div>
            {step < total - 1 ? <Button variant="ghost" onClick={() => setStep((s) => s + 1)}>Avançar<ArrowRight /></Button> : <span className="w-20" />}
          </div>
        </div>
      </div>
    </div>
  );
}
