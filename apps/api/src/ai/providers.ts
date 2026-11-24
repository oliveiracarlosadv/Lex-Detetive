import { fetchJson } from '../common/json';

export type ProviderId = 'ollama' | 'lmstudio' | 'openai' | 'gemini' | 'claude' | 'grok' | 'openrouter';

/**
 * keyUrl: tela de chaves da conta PESSOAL do desenvolvedor (não páginas de planos para empresas).
 * personal: orientação curta para pessoa física.
 */
export const PROVIDERS: { id: ProviderId; name: string; local: boolean; needsKey: boolean; baseUrl?: string; keyUrl: string; keyLabel: string; modelsUrl?: string; personal: string; free?: boolean }[] = [
  { id: 'ollama', name: 'Ollama (local)', local: true, needsKey: false, keyUrl: 'https://ollama.com/download', keyLabel: 'Baixar o Ollama', modelsUrl: 'https://ollama.com/library', personal: 'Gratuito, roda no seu computador; não precisa de chave.', free: true },
  { id: 'gemini', name: 'Google Gemini', local: false, needsKey: true, keyUrl: 'https://aistudio.google.com/apikey', keyLabel: 'Criar chave grátis no Google AI Studio', modelsUrl: 'https://ai.google.dev/gemini-api/docs/models', personal: 'Mais simples para pessoa física: entre com sua conta Google e clique em “Criar chave de API”. Tem cota gratuita.', free: true },
  { id: 'openai', name: 'OpenAI', local: false, needsKey: true, baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', keyLabel: 'Criar chave na OpenAI', modelsUrl: 'https://platform.openai.com/docs/models', personal: 'Entre com sua conta pessoal, clique em “Create new secret key”. Cobrança por uso (cartão de crédito).' },
  { id: 'claude', name: 'Anthropic Claude', local: false, needsKey: true, keyUrl: 'https://platform.claude.com/settings/keys', keyLabel: 'Criar chave na Anthropic', modelsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models', personal: 'Entre com Google ou e-mail pessoal (não precisa ser empresa) e clique em “Create Key”. Cobrança por uso.' },
  { id: 'grok', name: 'xAI Grok', local: false, needsKey: true, baseUrl: 'https://api.x.ai/v1', keyUrl: 'https://console.x.ai/team/default/api-keys', keyLabel: 'Criar chave na xAI', modelsUrl: 'https://docs.x.ai/docs/models', personal: 'Entre com Google, X ou e-mail e clique em “Create API key”. Cobrança por uso.' },
  { id: 'openrouter', name: 'OpenRouter', local: false, needsKey: true, baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/settings/keys', keyLabel: 'Criar chave no OpenRouter', modelsUrl: 'https://openrouter.ai/models', personal: 'Uma chave dá acesso a vários modelos, inclusive alguns gratuitos. Entre com Google ou e-mail.' },
  { id: 'lmstudio', name: 'LM Studio (local)', local: true, needsKey: false, keyUrl: 'https://lmstudio.ai/download', keyLabel: 'Baixar o LM Studio', personal: 'Gratuito, roda no seu computador; não precisa de chave.', free: true },
];

export interface ChatRequest { system: string; user: string; json?: boolean }
export interface ProviderConfig { id: ProviderId; model: string; apiKey?: string; baseUrl?: string }

const TIMEOUT = 180_000;

async function openAiCompatible(cfg: ProviderConfig, req: ChatRequest): Promise<string> {
  const base = cfg.baseUrl || PROVIDERS.find((p) => p.id === cfg.id)?.baseUrl;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.id === 'openrouter') { headers['HTTP-Referer'] = 'https://lextecnologias.com.br'; headers['X-Title'] = 'Lex Detetive'; }
  const data = await fetchJson(`${base}/chat/completions`, {
    method: 'POST', headers, timeoutMs: TIMEOUT,
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }],
      ...(req.json && cfg.id !== 'lmstudio' ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  return data?.choices?.[0]?.message?.content || '';
}

async function ollama(cfg: ProviderConfig, req: ChatRequest): Promise<string> {
  const data = await fetchJson(`${cfg.baseUrl || 'http://127.0.0.1:11434'}/api/chat`, {
    method: 'POST', timeoutMs: TIMEOUT, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model, stream: false, options: { temperature: 0.2, num_ctx: 4096 }, keep_alive: '2m', // contexto menor e liberação rápida da RAM
      ...(req.json ? { format: 'json' } : {}),
      messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }],
    }),
  });
  return data?.message?.content || '';
}

async function gemini(cfg: ProviderConfig, req: ChatRequest): Promise<string> {
  const data = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
    method: 'POST', timeoutMs: TIMEOUT,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey || '' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: [{ text: req.user }] }],
      generationConfig: { temperature: 0.2, ...(req.json ? { responseMimeType: 'application/json' } : {}) },
    }),
  });
  return (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
}

async function claude(cfg: ProviderConfig, req: ChatRequest): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk'); // só quando o Claude é usado
  const client = new Anthropic({ apiKey: cfg.apiKey, timeout: TIMEOUT });
  // fallbacks "default": se o modelo recusar por política, a API refaz no modelo recomendado.
  const response = await client.beta.messages.create({
    model: cfg.model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  });
  if (response.stop_reason === 'refusal') throw new Error('O modelo Claude recusou a solicitação.');
  return response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

export async function chat(cfg: ProviderConfig, req: ChatRequest): Promise<string> {
  const meta = PROVIDERS.find((p) => p.id === cfg.id);
  if (!meta) throw new Error(`Provedor de IA desconhecido: ${cfg.id}`);
  if (meta.needsKey && !cfg.apiKey) throw new Error(`Configure a chave de API do ${meta.name} em Configurações.`);
  switch (cfg.id) {
    case 'ollama': return ollama(cfg, req);
    case 'gemini': return gemini(cfg, req);
    case 'claude': return claude(cfg, req);
    default: return openAiCompatible(cfg, req);
  }
}

/** Modelos instalados localmente (Ollama / LM Studio). */
export async function localModels(cfg: ProviderConfig): Promise<string[]> {
  if (cfg.id === 'ollama') {
    const data = await fetchJson(`${cfg.baseUrl || 'http://127.0.0.1:11434'}/api/tags`, { timeoutMs: 4000 });
    return (data?.models || []).map((m: any) => m.name);
  }
  if (cfg.id === 'lmstudio') {
    const data = await fetchJson(`${cfg.baseUrl || 'http://127.0.0.1:1234/v1'}/models`, { timeoutMs: 4000 });
    return (data?.data || []).map((m: any) => m.id);
  }
  return [];
}
