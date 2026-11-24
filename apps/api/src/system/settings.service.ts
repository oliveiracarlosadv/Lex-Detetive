import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { decrypt, encrypt } from '../common/crypto';
import { LOCAL_AI_OK } from '../common/hardware';

/** Chave pública da API DataJud divulgada pelo CNJ (pode ser trocada em Configurações). */
export const DATAJUD_PUBLIC_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

export const SETTING_DEFAULTS: Record<string, string> = {
  'ai.provider': LOCAL_AI_OK ? 'ollama' : 'gemini',
  'ai.model.ollama': 'qwen2.5:3b',
  'ai.model.lmstudio': 'local-model',
  'ai.model.openai': 'gpt-4.1-mini',
  'ai.model.gemini': 'gemini-2.5-flash',
  'ai.model.claude': 'claude-opus-5-5',
  'ai.model.grok': 'grok-3-mini',
  'ai.model.openrouter': 'openrouter/auto',
  'ai.baseUrl.ollama': 'http://127.0.0.1:11434',
  'ai.baseUrl.lmstudio': 'http://127.0.0.1:1234/v1',
  'privacy.maskDocuments': 'true',
  'monitor.enabled': 'true',
  'ai.autoSummary': 'true',
  'org.name': 'Lex Tecnologias',
  'org.city': '',
  'auth.localMode': 'false', // início local sem senha (só no próprio computador)
  'auth.localUserId': '',
  'gmail.clientId': '',
  'diarios.ufs': 'PA', // estados cujos Diários Oficiais são consultados (além dos estados dos tribunais)
  'busca.searxngUrl': '', // metabuscador SearXNG (opcional): Google, Bing, DuckDuckGo e outros
  'mail.signature': '',
  'mail.signatureImage': '', // imagem da assinatura (data URL PNG/JPEG)
};

/** Chaves que nunca saem do servidor em claro. */
export const SECRET_PREFIXES = ['ai.key.', 'datajud.apiKey', 'transparencia.apiKey', 'gmail.clientSecret', 'social.braveKey'];
const isSecret = (key: string) => SECRET_PREFIXES.some((p) => key.startsWith(p));

@Injectable()
export class SettingsService {
  private cache = new Map<string, string>();
  constructor(private prisma: PrismaService) {}

  async get(key: string): Promise<string | undefined> {
    if (this.cache.has(key)) return this.cache.get(key);
    const row = await this.prisma.setting.findUnique({ where: { key } });
    const value = row ? (row.secret ? decrypt(row.value) : row.value) : SETTING_DEFAULTS[key];
    if (value !== undefined) this.cache.set(key, value);
    return value;
  }

  async getBool(key: string) {
    return (await this.get(key)) === 'true';
  }

  async set(key: string, value: string | null) {
    this.cache.delete(key);
    if (value === null || value === '') {
      await this.prisma.setting.deleteMany({ where: { key } });
      return;
    }
    const secret = isSecret(key);
    const stored = secret ? encrypt(value) : value;
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: stored, secret },
      update: { value: stored, secret },
    });
  }

  /** Lista para a tela de configurações: segredos aparecem só como "configurado". */
  async listPublic() {
    const rows = await this.prisma.setting.findMany();
    const out: Record<string, string | { configured: true }> = { ...SETTING_DEFAULTS };
    for (const r of rows) out[r.key] = r.secret ? { configured: true } : r.value;
    return out;
  }
}
