import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Client, Prisma } from '@prisma/client';
import { blindIndex, decryptOpt, encrypt, encryptOpt } from '../common/crypto';
import { formatCnpj, formatCpf, isValidCnj, isValidCnpj, isValidCpf, maskCnpj, maskCpf, onlyDigits, formatCnj } from '../common/documents';
import { fetchJson } from '../common/json';
import { PrismaService } from '../prisma.service';
import { SettingsService } from '../system/settings.service';
import { TargetsService } from '../targets/targets.service';
import { AUTOR, REU } from '../targets/ingest';
import { parseHandles } from '../connectors/social.connector';

/** Junta as redes sociais do cliente com as do monitoramento (sem repetir). */
const mergeHandles = (...lists: (string | null | undefined)[]) => parseHandles(lists.filter(Boolean).join(',')).join(', ');

const normName = (t?: string | null) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\b(LTDA|ME|EPP|EIRELI|S ?A|SA)\b/g, ' ').replace(/\s+/g, ' ').trim();
/** Mesmo nome (ignorando acentos, pontuação e LTDA/S.A.) ou o nome completo do cliente contido no nome da parte. */
export const nameMatches = (client: string | null | undefined, party: string) => {
  const c = normName(client), p = normName(party);
  if (!c || !p) return false;
  return c === p || (c.split(' ').length >= 2 && ` ${p} `.includes(` ${c} `));
};

export interface ClientInput {
  kind: 'PF' | 'PJ'; name: string; tradeName?: string; document?: string; rg?: string; stateReg?: string;
  birthDate?: string; maritalStatus?: string; profession?: string; nationality?: string;
  email?: string; email2?: string; phone?: string; whatsapp?: string; website?: string; usernames?: string;
  zip?: string; street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string;
  contactPerson?: string; responsible?: string; notes?: string; status?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['autor', 'réu', 'terceiro', 'interessado', 'parte'];
const PLAIN: (keyof ClientInput)[] = ['tradeName', 'stateReg', 'maritalStatus', 'profession', 'nationality', 'email', 'email2', 'phone', 'whatsapp', 'website', 'usernames',
  'zip', 'street', 'number', 'complement', 'district', 'city', 'state', 'contactPerson', 'responsible', 'notes', 'status'];

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService, private settings: SettingsService, private targets: TargetsService) {}

  private async view(c: Client & { _count?: { processes: number } }, reveal = false) {
    const mask = (await this.settings.getBool('privacy.maskDocuments')) && !reveal;
    const doc = decryptOpt(c.documentEnc);
    const { documentEnc, documentHash, rgEnc, ...rest } = c;
    return {
      ...rest,
      document: doc ? (mask ? c.documentMasked : c.kind === 'PF' ? formatCpf(doc) : formatCnpj(doc)) : null,
      rg: rgEnc ? (mask ? '***' : decryptOpt(rgEnc)) : null,
      processCount: c._count?.processes,
    };
  }

  private validate(input: Partial<ClientInput>, creating: boolean) {
    if (creating && !['PF', 'PJ'].includes(input.kind || '')) throw new BadRequestException('Tipo deve ser PF ou PJ.');
    if (creating && !input.name?.trim()) throw new BadRequestException('Informe o nome ou a razão social.');
    for (const k of ['email', 'email2'] as const) if (input[k] && !EMAIL.test(input[k]!.trim())) throw new BadRequestException(`E-mail inválido: ${input[k]}`);
    const doc = onlyDigits(input.document);
    if (doc && input.kind === 'PF' && !isValidCpf(doc)) throw new BadRequestException('CPF inválido.');
    if (doc && input.kind === 'PJ' && !isValidCnpj(doc)) throw new BadRequestException('CNPJ inválido.');
    return doc;
  }

  private data(input: Partial<ClientInput>, kind: string, doc: string) {
    const data: Record<string, unknown> = {};
    for (const k of PLAIN) if (input[k] !== undefined) data[k] = (input[k] as string)?.trim() || null;
    if (input.usernames !== undefined) data.usernames = parseHandles(input.usernames).join(', ') || null;
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.birthDate !== undefined) data.birthDate = input.birthDate ? new Date(input.birthDate) : null;
    if (input.rg !== undefined) data.rgEnc = encryptOpt(input.rg?.trim());
    if (input.zip) data.zip = onlyDigits(input.zip).replace(/(\d{5})(\d{3})/, '$1-$2');
    if (input.document !== undefined) {
      data.documentEnc = doc ? encrypt(doc) : null;
      data.documentHash = doc ? blindIndex(doc) : null;
      data.documentMasked = doc ? (kind === 'PF' ? maskCpf(doc) : maskCnpj(doc)) : null;
    }
    return data;
  }

  async list(q?: string, status?: string) {
    const where: Prisma.ClientWhereInput = {};
    if (status) where.status = status;
    if (q) {
      const digits = onlyDigits(q);
      where.OR = [{ name: { contains: q } }, { tradeName: { contains: q } }, { email: { contains: q } }, { city: { contains: q } }];
      if (digits.length === 11 || digits.length === 14) where.OR.push({ documentHash: blindIndex(digits) });
    }
    const rows = await this.prisma.client.findMany({ where, orderBy: { name: 'asc' }, include: { _count: { select: { processes: true } } } });
    return Promise.all(rows.map((r) => this.view(r)));
  }

  /**
   * Sugere clientes cadastrados para vincular a um processo: pelo CPF/CNPJ pesquisado ou pelos
   * nomes das partes. Devolve o papel provável (autor/réu) conforme o polo em que o nome aparece.
   */
  async suggest(parties: { name: string; role?: string }[] = [], document?: string) {
    const rows = await this.prisma.client.findMany({ select: { id: true, name: true, tradeName: true, kind: true, documentHash: true } });
    const digits = onlyDigits(document);
    const hash = digits.length === 11 || digits.length === 14 ? blindIndex(digits) : null;
    const roleOf = (r?: string) => (REU.test(r || '') ? 'réu' : AUTOR.test(r || '') ? 'autor' : 'parte');
    const out = new Map<string, { id: string; name: string; kind: string; role: string; reason: string }>();
    for (const c of rows) {
      const party = parties.filter((p) => !/advogad/i.test(p.role || '')).find((p) => nameMatches(c.name, p.name) || nameMatches(c.tradeName, p.name));
      if (party) out.set(c.id, { id: c.id, name: c.name, kind: c.kind, role: roleOf(party.role), reason: `nome igual ao da parte (${roleOf(party.role)})` });
      else if (hash && c.documentHash === hash) out.set(c.id, { id: c.id, name: c.name, kind: c.kind, role: 'parte', reason: 'mesmo CPF/CNPJ da pesquisa' });
    }
    // Quem bate pelo nome da parte vem primeiro (já sabemos o papel).
    return [...out.values()].sort((a, b) => Number(b.role !== 'parte') - Number(a.role !== 'parte'));
  }

  /**
   * Nomes de autor e réu que aparecem nos alertas, agrupados, com a indicação de quem já é
   * cliente cadastrado e de quantos desses processos já estão vinculados a ele.
   */
  async alertParties(unread: boolean) {
    const alerts = await this.prisma.alert.findMany({
      where: { read: unread ? false : undefined, data: { not: null } },
      orderBy: { createdAt: 'desc' }, take: 300, select: { id: true, processId: true, data: true },
    });
    const tidy = (x: string) => x.trim().replace(/^\d+\.\s*/, '').replace(/\s*\([A-ZÁ-Ú ]+\)$/i, '').replace(/[.\s]+$/, '').trim();
    const groups = new Map<string, { name: string; polos: Set<string>; alertIds: string[]; processIds: Set<string>; numbers: Set<string> }>();
    for (const a of alerts) {
      let card: any;
      try { card = JSON.parse(a.data!); } catch { continue; }
      for (const [polo, raw] of [['autor', card?.autor], ['réu', card?.reu]] as const) {
        for (const n of String(raw || '').split(';').map(tidy)) {
          if (!n || n.length < 4 || /^não informado/i.test(n)) continue;
          const key = normName(n);
          if (!key) continue;
          const g = groups.get(key) || { name: n, polos: new Set<string>(), alertIds: [], processIds: new Set<string>(), numbers: new Set<string>() };
          g.polos.add(polo);
          if (!g.alertIds.includes(a.id)) g.alertIds.push(a.id);
          if (a.processId) g.processIds.add(a.processId);
          else if (card?.processo) g.numbers.add(card.processo);
          groups.set(key, g);
        }
      }
    }
    // Alertas sem processo gravado: procura o processo pelo número.
    const numbers = [...new Set([...groups.values()].flatMap((g) => [...g.numbers]))];
    const byNumber = new Map((numbers.length ? await this.prisma.process.findMany({ where: { number: { in: numbers } }, select: { id: true, number: true } }) : []).map((p) => [p.number, p.id]));
    const clients = await this.prisma.client.findMany({ select: { id: true, name: true, tradeName: true, kind: true } });
    const out = [];
    for (const g of groups.values()) {
      for (const n of g.numbers) { const id = byNumber.get(n); if (id) g.processIds.add(id); }
      const c = clients.find((x) => nameMatches(x.name, g.name) || nameMatches(x.tradeName, g.name));
      const processIds = [...g.processIds];
      const linked = c && processIds.length ? await this.prisma.clientProcess.count({ where: { clientId: c.id, processId: { in: processIds } } }) : 0;
      out.push({
        name: g.name, polo: g.polos.size > 1 ? 'ambos' : [...g.polos][0], alertIds: g.alertIds, processIds,
        client: c ? { id: c.id, name: c.name, kind: c.kind } : null, linked,
      });
    }
    return out.sort((a, b) => Number(!!b.client) - Number(!!a.client) || b.alertIds.length - a.alertIds.length || a.name.localeCompare(b.name));
  }

  /** Vincula vários processos ao cliente de uma vez (botão "Sim" na tela de alertas). */
  async linkMany(clientId: string, processIds: string[], role?: string) {
    await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    const r = ROLES.includes(role || '') ? role! : 'parte';
    let count = 0;
    for (const processId of [...new Set(processIds)].slice(0, 300)) {
      if (!(await this.prisma.process.findUnique({ where: { id: processId }, select: { id: true } }))) continue;
      if (await this.prisma.clientProcess.findUnique({ where: { clientId_processId: { clientId, processId } } })) continue; // já vinculado
      await this.prisma.clientProcess.create({ data: { clientId, processId, role: r } });
      count++;
    }
    return { linked: count };
  }

  async get(id: string, reveal = false) {
    const c = await this.prisma.client.findUnique({
      where: { id },
      include: {
        _count: { select: { processes: true } },
        processes: {
          orderBy: { createdAt: 'desc' },
          include: { process: { include: { target: { select: { id: true, name: true } }, _count: { select: { movements: true } } } } },
        },
      },
    });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
    const links = c.processes.map((l) => ({ id: l.id, role: l.role, notes: l.notes, createdAt: l.createdAt, process: this.targets.processView(l.process) }));
    return { ...(await this.view(c, reveal)), processes: links };
  }

  async create(input: ClientInput) {
    const doc = this.validate(input, true);
    if (doc && (await this.prisma.client.findFirst({ where: { documentHash: blindIndex(doc) } })))
      throw new ConflictException('Já existe cliente com este documento.');
    return this.prisma.client.create({ data: { kind: input.kind, ...(this.data(input, input.kind, doc) as any) } });
  }

  async update(id: string, input: Partial<ClientInput>) {
    const c = await this.prisma.client.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    const doc = this.validate({ ...input, kind: c.kind as 'PF' | 'PJ' }, false);
    const updated = await this.prisma.client.update({ where: { id }, data: this.data(input, c.kind, doc) });
    // Redes sociais novas do cliente passam também para o monitoramento dele.
    if (input.usernames && c.targetId) {
      const t = await this.prisma.target.findUnique({ where: { id: c.targetId }, select: { usernames: true } });
      if (t) await this.targets.update(c.targetId, { usernames: mergeHandles(t.usernames, input.usernames) });
    }
    return updated;
  }

  remove(id: string) {
    return this.prisma.client.delete({ where: { id } });
  }

  /** Vincula um processo já existente (processId) ou um número CNJ novo (consultado no DataJud). */
  async link(clientId: string, body: { processId?: string; number?: string; targetId?: string; role?: string; notes?: string }) {
    const role = ROLES.includes(body.role || '') ? body.role! : 'parte';
    // Todos os processos de uma pessoa/empresa monitorada (alertas sem processo específico).
    if (body.targetId && !body.processId && !body.number) {
      const procs = await this.prisma.process.findMany({ where: { targetId: body.targetId }, select: { id: true } });
      if (!procs.length) throw new BadRequestException('Esta pessoa/empresa ainda não tem processos para vincular.');
      for (const p of procs) {
        await this.prisma.clientProcess.upsert({ where: { clientId_processId: { clientId, processId: p.id } }, create: { clientId, processId: p.id, role }, update: {} });
      }
      return { processId: procs[0].id, role, count: procs.length };
    }
    let processId = body.processId;
    if (!processId) {
      if (!body.number || !isValidCnj(body.number)) throw new BadRequestException('Número CNJ inválido.');
      const existing = await this.prisma.process.findFirst({ where: { number: formatCnj(body.number) } });
      if (existing) processId = existing.id;
      else {
        const targetId = await this.ensureTarget(clientId, false);
        processId = (await this.targets.attachNumber(targetId, body.number)).id;
      }
    }
    await this.prisma.process.findUniqueOrThrow({ where: { id: processId } });
    return this.prisma.clientProcess.upsert({
      where: { clientId_processId: { clientId, processId } },
      create: { clientId, processId, role, notes: body.notes },
      update: { role, notes: body.notes },
    });
  }

  unlink(clientId: string, linkId: string) {
    return this.prisma.clientProcess.deleteMany({ where: { id: linkId, clientId } });
  }

  /**
   * Liga um cliente recém-cadastrado a uma pessoa/empresa já monitorada (ex.: a partir de um
   * alerta): o monitoramento vira a rotina do cliente e os processos passam a constar dele.
   */
  async linkTarget(clientId: string, targetId: string) {
    const [c, t] = await Promise.all([
      this.prisma.client.findUnique({ where: { id: clientId } }),
      this.prisma.target.findUnique({ where: { id: targetId } }),
    ]);
    if (!c) throw new NotFoundException('Cliente não encontrado.');
    if (!t) throw new NotFoundException('Pessoa/empresa monitorada não encontrada.');
    const other = await this.prisma.client.findFirst({ where: { targetId, NOT: { id: clientId } }, select: { name: true } });
    if (other) throw new ConflictException(`Este monitoramento já pertence ao cliente ${other.name}.`);
    // Documento do monitoramento aproveitado no cadastro, se o cliente ainda não tiver.
    const doc = !c.documentEnc && t.documentEnc ? { documentEnc: t.documentEnc, documentHash: t.documentHash, documentMasked: t.documentMasked } : {};
    await this.prisma.client.update({ where: { id: clientId }, data: { targetId, ...doc } });
    return this.ensureTarget(clientId, false);
  }

  /** Cria (ou reaproveita) o perfil de monitoramento do cliente — a "rotina do cliente". */
  async ensureTarget(clientId: string, monitored: boolean, opts: { intervalMinutes?: number; purpose?: string; processNumbers?: string[]; oab?: string } = {}): Promise<string> {
    const c = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    let targetId = c.targetId && (await this.prisma.target.findUnique({ where: { id: c.targetId } })) ? c.targetId : null;
    if (!targetId) {
      const doc = decryptOpt(c.documentEnc);
      const same = doc ? await this.prisma.target.findFirst({ where: { documentHash: blindIndex(doc) } }) : null;
      targetId = same?.id || (await this.targets.create({
        kind: c.kind as 'PF' | 'PJ', name: c.name, tradeName: c.tradeName || undefined, document: doc || undefined,
        monitored, intervalMinutes: opts.intervalMinutes || 1440, purpose: opts.purpose || 'Acompanhamento de cliente do escritório', oab: opts.oab,
        usernames: c.usernames || undefined,
      })).id;
      await this.prisma.client.update({ where: { id: clientId }, data: { targetId } });
    }
    await this.targets.update(targetId, {
      ...(monitored ? { monitored: true } : {}),
      ...(opts.intervalMinutes ? { intervalMinutes: opts.intervalMinutes } : {}),
      ...(opts.purpose ? { purpose: opts.purpose } : {}),
      ...(opts.oab ? { oab: opts.oab } : {}),
      ...(c.usernames ? { usernames: mergeHandles((await this.prisma.target.findUnique({ where: { id: targetId }, select: { usernames: true } }))?.usernames, c.usernames) } : {}),
    });
    for (const n of opts.processNumbers || []) if (isValidCnj(n)) await this.targets.attachNumber(targetId, n);
    // Processos que já estavam no monitoramento passam a constar do cliente.
    // Possíveis homônimos (CPF diferente do cadastrado) ficam de fora.
    const procs = await this.prisma.process.findMany({ where: { targetId, docStatus: { not: 'divergente' } }, select: { id: true } });
    for (const p of procs) {
      await this.prisma.clientProcess.upsert({ where: { clientId_processId: { clientId, processId: p.id } }, create: { clientId, processId: p.id }, update: {} });
    }
    return targetId;
  }

  /** Processos já conhecidos pelo sistema (para vincular a clientes). */
  async searchProcesses(q: string) {
    const digits = onlyDigits(q);
    const rows = await this.prisma.process.findMany({
      where: q ? { OR: [{ number: { contains: digits.length >= 7 ? formatCnj(digits).slice(0, q.length + 4) : q } }, { number: { contains: q } }, { className: { contains: q } }, { target: { name: { contains: q } } }] } : {},
      take: 30, orderBy: { updatedAt: 'desc' },
      include: { target: { select: { id: true, name: true } } },
    });
    return rows.map((p) => this.targets.processView(p));
  }

  async cep(cep: string) {
    const d = onlyDigits(cep);
    if (d.length !== 8) throw new BadRequestException('CEP inválido.');
    const r = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${d}`, { timeoutMs: 10000 });
    return { zip: d.replace(/(\d{5})(\d{3})/, '$1-$2'), street: r.street, district: r.neighborhood, city: r.city, state: r.state };
  }
}
