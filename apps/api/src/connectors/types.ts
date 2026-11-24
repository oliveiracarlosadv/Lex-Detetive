export type PersonKind = 'PF' | 'PJ';

export interface SearchQuery {
  kind: PersonKind;
  name?: string;
  cpf?: string;
  cnpj?: string;
  rg?: string;
  motherName?: string;
  fatherName?: string;
  tradeName?: string;
  partners?: string[];
  /** OAB do advogado ("12345/PA") para intimações no DJEN. */
  oab?: string;
  /** Nomes de usuário em redes sociais (@fulano). */
  usernames?: string[];
  /** Tribunais dos processos já conhecidos (definem os diários estaduais a consultar). */
  courts?: string[];
  /** Números CNJ já conhecidos (para consulta/monitoramento por processo). */
  processNumbers?: string[];
  /** Verificação periódica: as fontes buscam só o período recente (mais leve). */
  incremental?: boolean;
}

export interface FoundParty { name: string; role?: string; lawyers?: string[] }
export interface FoundMovement {
  date: string; code?: string; description: string;
  /** Texto usado só para identificar a movimentação (mantém compatível com as já gravadas). */
  fingerprintText?: string;
}

export interface FoundProcess {
  number: string;
  court: string;
  system?: string;
  className?: string;
  subjects?: string[];
  organ?: string;
  degree?: string;
  status?: 'ativo' | 'baixado' | 'arquivado';
  value?: number;
  parties?: FoundParty[];
  filedAt?: string;
  movements: FoundMovement[];
  url?: string;
  raw?: unknown;
  /** Conferência do CPF/CNPJ do monitorado nas publicações (homônimos). */
  docCheck?: import('../common/doc-match').DocCheck;
}

export interface FoundRecord { title: string; detail?: string; date?: string; url?: string; severity?: 'info' | 'atencao' | 'critico' }

export interface ConnectorResult {
  connectorId: string;
  connectorName: string;
  ok: boolean;
  /** "skipped" quando a fonte não se aplica à pesquisa (ex.: CNPJ numa pessoa física). */
  skipped?: boolean;
  message?: string;
  processes: FoundProcess[];
  /** Dados cadastrais (ex.: Receita Federal), comparados entre verificações. */
  registry?: Record<string, unknown>;
  /** Outros achados: sanções, publicações em diários oficiais etc. */
  records?: FoundRecord[];
  durationMs?: number;
}

export type Capability = 'nome' | 'cpf' | 'cnpj' | 'processo';
export type Category = 'judicial' | 'cadastral' | 'sancoes' | 'diarios' | 'redes';

export interface ConnectorContext {
  setting(key: string): Promise<string | undefined>;
}

export interface Connector {
  id: string;
  name: string;
  category: Category;
  description: string;
  capabilities: Capability[];
  /** Chave de configuração exigida, se houver. */
  requiresSetting?: string;
  website?: string;
  isEnabled(ctx: ConnectorContext): Promise<{ enabled: boolean; reason?: string }>;
  appliesTo(q: SearchQuery): boolean;
  search(q: SearchQuery, ctx: ConnectorContext): Promise<Omit<ConnectorResult, 'connectorId' | 'connectorName'>>;
}
