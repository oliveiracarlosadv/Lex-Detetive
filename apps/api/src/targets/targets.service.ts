import { parseHandles } from '../connectors/social.connector';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Target } from '@prisma/client';
import { blindIndex, decryptOpt, encrypt, encryptOpt } from '../common/crypto';
import {
  formatCnj, isValidCnj, isValidCnpj, isValidCpf, maskCnpj, maskCpf, onlyDigits, formatCpf, formatCnpj,
} from '../common/documents';
import { parseJson } from '../common/json';
import { ConnectorResult, FoundRecord, SearchQuery } from '../connectors/types';
import { PrismaService } from '../prisma.service';
import { SettingsService } from '../system/settings.service';
import { DOC_RANK, DocStatus, mergeChecks } from '../common/doc-match';
import { diffRegistry, movementFingerprint, newRecords, processCard } from './ingest';

export const INTERVALS = [1, 5, 15, 30, 60, 360, 1440];

export interface TargetInput {
  kind: 'PF' | 'PJ';
  name: string;
  document?: string;
  tradeName?: string;
  rg?: string;
  motherName?: string;
  fatherName?: string;
  partners?: string[];
  notes?: string;
  purpose?: string;
  oab?: string;
  usernames?: string;
  monitored?: boolean;
  intervalMinutes?: number;
  processNumbers?: string[];
}

export interface IngestSummary { newProcesses: number; newMovements: number; alerts: number; registryChanges: number; newRecords: number; intimacoes: number; summarize: string[] }

/**
 * Movimentação "nova de verdade": dos últimos 15 dias ou posterior à última já conhecida do processo
 * (1 dia de folga, pois as fontes datam publicações de formas diferentes).
 */
export function isRecentMovement(date: string | Date, lastKnown: Date | null, now = Date.now()) {
  const t = new Date(date).getTime();
  if (t >= now - 15 * 86_400_000) return true;
  return !!lastKnown && t > lastKnown.getTime() - 86_400_000;
}

@Injectable()
export class TargetsService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  // ---------- leitura ----------
  async view(t: Target & { _count?: { processes: number; alerts: number } }, reveal = false) {
    const mask = (await this.settings.getBool('privacy.maskDocuments')) && !reveal;
    const doc = decryptOpt(t.documentEnc);
    return {
      id: t.id, kind: t.kind, name: t.name, tradeName: t.tradeName,
      document: doc ? (mask ? t.documentMasked : t.kind === 'PF' ? formatCpf(doc) : formatCnpj(doc)) : null,
      documentMasked: t.documentMasked,
      rg: t.rgEnc ? (mask ? '***' : decryptOpt(t.rgEnc)) : null,
      motherName: t.motherName, fatherName: t.fatherName,
      partners: parseJson<string[]>(t.partners, []),
      notes: t.notes, purpose: t.purpose, oab: t.oab, usernames: t.usernames,
      monitored: t.monitored, intervalMinutes: t.intervalMinutes,
      lastCheckedAt: t.lastCheckedAt, nextCheckAt: t.nextCheckAt,
      lastCheck: parseJson(t.lastCheckSummary, null),
      registry: parseJson(t.registry, null),
      createdAt: t.createdAt, updatedAt: t.updatedAt,
      counts: t._count,
    };
  }

  async list(filter: { kind?: string; monitored?: string; q?: string }) {
    const where: Prisma.TargetWhereInput = {};
    if (filter.kind) where.kind = filter.kind;
    if (filter.monitored === 'true') where.monitored = true;
    if (filter.q) {
      const digits = onlyDigits(filter.q);
      where.OR = [{ name: { contains: filter.q } }, { tradeName: { contains: filter.q } }];
      if (digits.length === 11 || digits.length === 14) where.OR.push({ documentHash: blindIndex(digits) });
    }
    const rows = await this.prisma.target.findMany({
      where, orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { processes: true, alerts: { where: { read: false } } } } },
    });
    return Promise.all(rows.map((r) => this.view(r)));
  }

  async get(id: string, reveal = false) {
    const t = await this.prisma.target.findUnique({
      where: { id },
      include: { _count: { select: { processes: true, alerts: { where: { read: false } } } } },
    });
    if (!t) throw new NotFoundException('Pessoa/empresa não encontrada.');
    const [processes, snapshots, analyses] = await Promise.all([
      this.prisma.process.findMany({
        where: { targetId: id }, orderBy: [{ lastMovementAt: 'desc' }],
        include: { _count: { select: { movements: true } } },
      }),
      this.prisma.snapshot.findMany({ where: { targetId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.analysis.findMany({ where: { targetId: id, processId: null }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);
    return {
      ...(await this.view(t, reveal)),
      // Indexado pelo CPF: confirmados primeiro, depois sem documento, por último os possíveis homônimos.
      processes: processes.map((p) => this.processView(p)).sort((a, b) => (DOC_RANK[a.docStatus] ?? 1) - (DOC_RANK[b.docStatus] ?? 1)),
      docSummary: {
        confirmado: processes.filter((p) => p.docStatus === 'confirmado').length,
        nao_informado: processes.filter((p) => p.docStatus === 'nao_informado').length,
        divergente: processes.filter((p) => p.docStatus === 'divergente').length,
      },
      snapshots: snapshots.map((s) => ({ ...s, data: parseJson(s.data), changes: parseJson(s.changes) })),
      analyses: analyses.map((a) => ({ ...a, result: parseJson(a.result) })),
    };
  }

  processView(p: any) {
    return {
      ...p,
      subjects: parseJson(p.subjects, []),
      parties: parseJson(p.parties, []),
      raw: undefined,
      movementsCount: p._count?.movements,
      _count: undefined,
    };
  }

  async getProcess(id: string) {
    const p = await this.prisma.process.findUnique({
      where: { id },
      include: {
        movements: { orderBy: { date: 'desc' } },
        target: { select: { id: true, name: true, kind: true } },
        analyses: { orderBy: { createdAt: 'desc' }, take: 5 },
        clientLinks: { include: { client: { select: { id: true, name: true } } } },
      },
    });
    if (!p) throw new NotFoundException('Processo não encontrado.');
    return {
      ...this.processView(p),
      card: processCard(p, p.movements),
      clients: p.clientLinks.map((l) => ({ id: l.client.id, name: l.client.name, role: l.role })),
      clientLinks: undefined,
      analyses: p.analyses.map((a) => ({ ...a, result: parseJson(a.result) })),
    };
  }

  // ---------- escrita ----------
  private normalize(input: TargetInput) {
    if (!['PF', 'PJ'].includes(input.kind)) throw new BadRequestException('Tipo deve ser PF ou PJ.');
    if (!input.name?.trim() && !input.document) throw new BadRequestException('Informe ao menos o nome ou o documento.');
    const doc = onlyDigits(input.document);
    if (doc) {
      if (input.kind === 'PF' && !isValidCpf(doc)) throw new BadRequestException('CPF inválido.');
      if (input.kind === 'PJ' && !isValidCnpj(doc)) throw new BadRequestException('CNPJ inválido.');
    }
    if (input.intervalMinutes && !INTERVALS.includes(input.intervalMinutes)) throw new BadRequestException('Intervalo de monitoramento inválido.');
    if (input.oab && !/^\s*\d{1,7}\s*\/\s*[A-Za-z]{2}\s*$/.test(input.oab)) throw new BadRequestException('OAB deve estar no formato 12345/UF.');
    const numbers = (input.processNumbers || []).map((n) => n.trim()).filter(Boolean);
    for (const n of numbers) if (!isValidCnj(n)) throw new BadRequestException(`Número de processo inválido: ${n}`);
    return { doc, numbers };
  }

  async create(input: TargetInput) {
    const { doc, numbers } = this.normalize(input);
    if (doc) {
      const existing = await this.prisma.target.findFirst({ where: { documentHash: blindIndex(doc) } });
      if (existing) throw new ConflictException({ message: 'Este documento já está cadastrado.', id: existing.id });
    }
    const target = await this.prisma.target.create({
      data: {
        kind: input.kind,
        name: (input.name || '').trim() || (input.kind === 'PF' ? formatCpf(doc) : formatCnpj(doc)),
        tradeName: input.tradeName?.trim() || null,
        documentEnc: doc ? encrypt(doc) : null,
        documentHash: doc ? blindIndex(doc) : null,
        documentMasked: doc ? (input.kind === 'PF' ? maskCpf(doc) : maskCnpj(doc)) : null,
        rgEnc: encryptOpt(input.rg?.trim()),
        motherName: input.motherName?.trim() || null,
        fatherName: input.fatherName?.trim() || null,
        partners: input.partners?.length ? JSON.stringify(input.partners) : null,
        notes: input.notes || null,
        purpose: input.purpose || null,
        oab: input.oab?.trim() || null,
        usernames: parseHandles(input.usernames).join(', ') || null,
        monitored: !!input.monitored,
        intervalMinutes: input.intervalMinutes || 1440,
        nextCheckAt: input.monitored ? new Date() : null,
      },
    });
    for (const n of numbers) await this.attachNumber(target.id, n);
    return target;
  }

  async update(id: string, input: Partial<TargetInput>) {
    const t = await this.prisma.target.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    if (input.intervalMinutes && !INTERVALS.includes(input.intervalMinutes)) throw new BadRequestException('Intervalo inválido.');
    const monitored = input.monitored ?? t.monitored;
    // CPF/CNPJ informado depois do cadastro (necessário para conferir homônimos).
    let docData: Record<string, string | null> = {};
    const doc = onlyDigits(input.document);
    if (doc) {
      if (t.kind === 'PF' ? !isValidCpf(doc) : !isValidCnpj(doc)) throw new BadRequestException(t.kind === 'PF' ? 'CPF inválido.' : 'CNPJ inválido.');
      const other = await this.prisma.target.findFirst({ where: { documentHash: blindIndex(doc), NOT: { id } } });
      if (other) throw new ConflictException({ message: 'Este documento já está em outro monitoramento.', id: other.id });
      docData = { documentEnc: encrypt(doc), documentHash: blindIndex(doc), documentMasked: t.kind === 'PF' ? maskCpf(doc) : maskCnpj(doc) };
    }
    return this.prisma.target.update({
      where: { id },
      data: {
        ...docData,
        name: input.name?.trim() || undefined,
        tradeName: input.tradeName,
        motherName: input.motherName,
        fatherName: input.fatherName,
        notes: input.notes,
        purpose: input.purpose,
        oab: input.oab === undefined ? undefined : input.oab.trim() || null,
        usernames: input.usernames === undefined ? undefined : parseHandles(input.usernames).join(', ') || null,
        partners: input.partners ? JSON.stringify(input.partners) : undefined,
        monitored,
        intervalMinutes: input.intervalMinutes,
        nextCheckAt: monitored ? (input.monitored && !t.monitored ? new Date() : t.nextCheckAt ?? new Date()) : null,
      },
    });
  }

  /** LGPD: eliminação definitiva dos dados da pessoa/empresa e de tudo que foi coletado. */
  async remove(id: string) {
    // O cliente ligado a este monitoramento volta a mostrar "Monitorar" (sem vínculo quebrado).
    await this.prisma.client.updateMany({ where: { targetId: id }, data: { targetId: null } });
    await this.prisma.target.delete({ where: { id } });
  }

  async attachNumber(targetId: string, number: string) {
    if (!isValidCnj(number)) throw new BadRequestException('Número CNJ inválido.');
    const formatted = formatCnj(number);
    return this.prisma.process.upsert({
      where: { targetId_number: { targetId, number: formatted } },
      create: { targetId, number: formatted, court: '—', source: 'manual', className: 'Aguardando consulta' },
      update: {},
    });
  }

  async buildQuery(id: string): Promise<SearchQuery> {
    const t = await this.prisma.target.findUniqueOrThrow({ where: { id }, include: { processes: { select: { number: true, court: true } } } });
    const doc = decryptOpt(t.documentEnc) || undefined;
    return {
      kind: t.kind as 'PF' | 'PJ',
      name: t.name,
      tradeName: t.tradeName || undefined,
      cpf: t.kind === 'PF' ? doc : undefined,
      cnpj: t.kind === 'PJ' ? doc : undefined,
      motherName: t.motherName || undefined,
      fatherName: t.fatherName || undefined,
      partners: parseJson<string[]>(t.partners, []),
      oab: t.oab || undefined,
      usernames: parseHandles(t.usernames),
      processNumbers: t.processes.map((p) => p.number),
      courts: [...new Set(t.processes.map((p) => p.court))],
    };
  }

  // ---------- consolidação dos resultados ----------
  async ingest(targetId: string, results: ConnectorResult[], opts: { initial: boolean }): Promise<IngestSummary> {
    const summary: IngestSummary = { newProcesses: 0, newMovements: 0, alerts: 0, registryChanges: 0, newRecords: 0, intimacoes: 0, summarize: [] };
    const target = await this.prisma.target.findUniqueOrThrow({ where: { id: targetId } });
    // Um alerta por processo em cada verificação: se outra fonte já avisou deste processo nesta
    // mesma verificação, atualiza aquele alerta (intimação prevalece) em vez de criar outro.
    const byProcess = new Map<string, { id: string; type: string }>();
    const alert = async (data: { type: string; title: string; message: string; severity?: string; processId?: string; data?: string }) => {
      const prev = data.processId && ['intimacao', 'movimentacao'].includes(data.type) ? byProcess.get(data.processId) : undefined;
      if (prev) {
        const keep = prev.type === 'intimacao' && data.type !== 'intimacao';
        const updated = await this.prisma.alert.update({ where: { id: prev.id }, data: keep ? { data: data.data } : { ...data, read: false } });
        byProcess.set(data.processId!, { id: updated.id, type: updated.type });
        return updated;
      }
      summary.alerts++;
      const created = await this.prisma.alert.create({ data: { targetId, ...data } });
      if (data.processId && ['intimacao', 'movimentacao'].includes(data.type)) byProcess.set(data.processId, { id: created.id, type: created.type });
      return created;
    };

    for (const r of results) {
      if (!r.ok || r.skipped) continue;

      for (const fp of r.processes) {
        const number = formatCnj(fp.number);
        const existing = await this.prisma.process.findUnique({ where: { targetId_number: { targetId, number } } });
        const lastMovementAt = fp.movements[0] ? new Date(fp.movements[0].date) : null;
        // Cada fonte traz partes diferentes do mesmo processo (DataJud: metadados; DJEN: partes e
        // intimações). Só sobrescrevemos o que a fonte atual realmente informou.
        const prevParties = existing ? parseJson<{ name: string }[]>(existing.parties, []) : [];
        const mergedParties = [...prevParties, ...(fp.parties || []).filter((p) => !prevParties.some((x) => x.name === p.name))];
        const data: Record<string, any> = {
          court: fp.court || existing?.court || '—',
          parties: JSON.stringify(mergedParties),
          status: fp.status || existing?.status || 'ativo',
          source: existing && existing.source !== 'manual' && existing.source !== r.connectorId ? `${existing.source}+${r.connectorId}`.split('+').filter((v, i, a) => a.indexOf(v) === i).join('+') : r.connectorId,
        };
        if (fp.system) data.system = fp.system;
        if (fp.className) data.className = fp.className;
        if (fp.organ) data.organ = fp.organ;
        if (fp.degree) data.degree = fp.degree;
        if (fp.subjects?.length) data.subjects = JSON.stringify(fp.subjects);
        if (fp.value != null) data.value = fp.value;
        if (fp.filedAt) data.filedAt = new Date(fp.filedAt);
        if (fp.raw) data.raw = JSON.stringify(fp.raw);
        if (fp.docCheck) {
          const prev = existing ? { status: existing.docStatus as DocStatus, found: existing.docFound || undefined } : undefined;
          const merged = mergeChecks(prev && prev.status !== 'nao_informado' ? prev : undefined, fp.docCheck);
          data.docStatus = merged.status;
          data.docFound = merged.found || null;
        }
        const homonym = (data.docStatus ?? existing?.docStatus) === 'divergente';
        const homonymNote = homonym ? ' — CPF diferente do cadastrado (possível homônimo)' : '';
        let processId: string;
        const isNew = !existing || existing.source === 'manual';
        if (!existing) {
          processId = (await this.prisma.process.create({ data: { targetId, number, ...data, lastMovementAt } as any })).id;
          summary.newProcesses++;
          if (!opts.initial) {
            const card = processCard({ ...(data as any), number }, fp.movements, fp.movements.slice(0, 3));
            const a = await alert({ type: 'novo_processo', severity: homonym ? 'info' : 'atencao', processId, title: `Novo processo: ${number}${homonymNote}`, message: `${fp.className || 'Processo'} no ${fp.court}.`, data: JSON.stringify(card) });
            summary.summarize.push(a.id);
          }
        } else {
          processId = existing.id;
          await this.prisma.process.update({
            where: { id: processId },
            data: { ...data, lastMovementAt: lastMovementAt && (!existing.lastMovementAt || lastMovementAt > existing.lastMovementAt) ? lastMovementAt : existing.lastMovementAt },
          });
          if (existing.source !== 'manual' && existing.status === 'ativo' && fp.status && fp.status !== 'ativo')
            await alert({ type: 'baixa', severity: 'atencao', processId, title: `Processo baixado: ${number}`, message: fp.movements[0]?.description || 'Baixa registrada.' });
        }

        // Possível homônimo (CPF diferente) não entra automaticamente na rotina do cliente.
        if (!homonym) await this.linkToClients(targetId, processId, mergedParties);

        const known = new Set((await this.prisma.movement.findMany({ where: { processId }, select: { fingerprint: true } })).map((m) => m.fingerprint));
        const fresh: typeof fp.movements = [];
        for (const m of fp.movements) {
          const fingerprint = movementFingerprint(m.date, m.fingerprintText ?? m.description);
          if (known.has(fingerprint)) continue; // já gravada ou repetida no mesmo lote
          known.add(fingerprint);
          try {
            await this.prisma.movement.create({ data: { processId, date: new Date(m.date), code: m.code, description: m.description, fingerprint } });
            fresh.push(m);
          } catch (e) {
            if (e?.code !== 'P2002') throw e; // gravada por verificação simultânea
          }
        }
        summary.newMovements += fresh.length;
        // Só é novidade o que é recente. As fontes trazem um número limitado de páginas por consulta,
        // então publicações antigas ainda não vistas podem aparecer depois: são gravadas no histórico,
        // mas não geram alerta (evita "voltar" processos já lidos com publicações de meses atrás).
        const alertable = fresh.filter((m) => isRecentMovement(m.date, existing?.lastMovementAt ?? null));
        if (alertable.length && !isNew && !opts.initial) {
          const all = await this.prisma.movement.findMany({ where: { processId }, select: { date: true, description: true } });
          const card = processCard({ ...(data as any), value: data.value ?? existing?.value, organ: data.organ ?? existing?.organ, className: data.className ?? existing?.className, number }, all, alertable);
          if (card.intimacao) summary.intimacoes++;
          const a = await alert({
            type: card.intimacao ? 'intimacao' : 'movimentacao', processId,
            severity: homonym ? 'info' : card.intimacao ? 'critico' : 'info',
            title: (card.intimacao ? `Intimação/citação — ${number}` : `${alertable.length} nova(s) movimentação(ões) — ${number}`) + homonymNote,
            message: alertable[0].description,
            data: JSON.stringify(card),
          });
          summary.summarize.push(a.id);
        }
      }

      if (r.registry) {
        const before = parseJson<Record<string, unknown> | null>(target.registry, null);
        const changes = diffRegistry(before, r.registry);
        if (!before || changes.length) {
          await this.prisma.snapshot.create({ data: { targetId, source: r.connectorId, data: JSON.stringify(r.registry), changes: changes.length ? JSON.stringify(changes) : null } });
          await this.prisma.target.update({ where: { id: targetId }, data: { registry: JSON.stringify(r.registry) } });
        }
        if (changes.length) {
          summary.registryChanges += changes.length;
          await alert({ type: 'alteracao_cadastral', severity: 'atencao', title: `Alteração cadastral (${changes.length} campo(s))`, message: changes.map((c) => c.field).join(', ') });
        }
      }

      if (r.records) {
        const last = await this.prisma.snapshot.findFirst({ where: { targetId, source: r.connectorId }, orderBy: { createdAt: 'desc' } });
        const fresh = newRecords(parseJson<FoundRecord[] | null>(last?.data, null), r.records);
        if (!last || fresh.length) {
          await this.prisma.snapshot.create({ data: { targetId, source: r.connectorId, data: JSON.stringify(r.records), changes: fresh.length ? JSON.stringify(fresh) : null } });
        }
        summary.newRecords += fresh.length;
        for (const rec of fresh) {
          // Sanções sempre geram alerta; publicações só depois da primeira pesquisa.
          // Buscadores e redes sociais variam a cada consulta: só alertam página nova citando o CPF/CNPJ.
          const noisy = ['buscadores', 'redes-sociais'].includes(r.connectorId) && rec.severity !== 'atencao';
          if (rec.severity === 'critico' || (!opts.initial && last && !noisy))
            await alert({ type: rec.severity === 'critico' ? 'sancao' : 'publicacao', severity: rec.severity || 'info', title: rec.title, message: rec.detail?.slice(0, 300) || '' });
        }
      }
    }

    if (opts.initial) {
      await alert({
        type: 'pesquisa_inicial', title: `Pesquisa inicial concluída — ${target.name}`,
        message: `${summary.newProcesses} processo(s), ${summary.newMovements} movimentação(ões) e ${summary.newRecords} outro(s) achado(s).`,
      });
    }
    summary.summarize = [...new Set(summary.summarize)];
    return summary;
  }

  /**
   * Rotina do cliente: todo processo encontrado no monitoramento de um cliente
   * é vinculado a ele automaticamente, com o papel deduzido do polo quando possível.
   */
  private async linkToClients(targetId: string, processId: string, parties: { name: string; role?: string }[]) {
    const clients = await this.prisma.client.findMany({ where: { targetId }, select: { id: true, name: true } });
    for (const c of clients) {
      const words = c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const mine = parties.find((p) => { const n = p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); return words.length && words.every((w) => n.includes(w)); });
      const role = mine?.role ? (/ativo|autor|requerente|reclamante|exequente/i.test(mine.role) ? 'autor' : /passivo|r[ée]u|requerid|reclamad|executad/i.test(mine.role) ? 'réu' : 'parte') : 'parte';
      await this.prisma.clientProcess.upsert({
        where: { clientId_processId: { clientId: c.id, processId } },
        create: { clientId: c.id, processId, role },
        update: {},
      });
    }
  }
}
