import { LogoMark } from './logo';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div><div className="text-lg font-semibold">Lex Detetive</div><div className="text-[10px] tracking-[0.25em] text-gold">LEX TECNOLOGIAS</div></div>
        </div>
        <div>
          <p className="max-w-md text-3xl font-semibold leading-tight">Investigação jurídica inteligente.</p>
          <p className="mt-4 max-w-md text-sm text-white/70">Pesquise, monitore e analise processos e registros públicos de pessoas e empresas, com IA local e seus dados protegidos no seu computador.</p>
        </div>
        <p className="text-xs text-white/50">Dados tratados conforme a LGPD · criptografia AES-256 local</p>
        <svg className="pointer-events-none absolute -right-24 -bottom-24 size-[420px] opacity-[0.07]" viewBox="0 0 64 64"><circle cx="27" cy="27" r="16" fill="none" stroke="#C9A227" strokeWidth="4" /><path d="M39 39 L52 52" stroke="#C9A227" strokeWidth="6.5" strokeLinecap="round" /></svg>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><LogoMark className="size-10" /><span className="text-lg font-semibold">Lex Detetive</span></div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
