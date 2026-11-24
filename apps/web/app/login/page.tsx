'use client';
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { AuthLayout } from '@/components/auth-layout';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Tela de desbloqueio: aparece só quando há senha de bloqueio (Configurações → Segurança). */
export default function UnlockPage() {
  const { signIn } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api('/auth/unlock', { method: 'POST', body: { password } });
      signIn('local', await api('/auth/me'));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <AuthLayout title="Lex Detetive bloqueado" subtitle="Digite a senha de bloqueio deste navegador.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Senha"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></Field>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button className="w-full" loading={loading}><Lock />Desbloquear</Button>
        <p className="text-xs text-muted-foreground">Esqueceu a senha? Os dados ficam só neste navegador e não há como recuperá-la. Se tiver um backup, apague os dados do site nas configurações do navegador e importe o backup.</p>
      </form>
    </AuthLayout>
  );
}
