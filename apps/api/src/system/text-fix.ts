import { PrismaClient } from '@prisma/client';
import { cleanDeep, cleanText, needsCleaning } from '../common/text';
import { parseJson } from '../common/json';

const KEY = 'fix.texto_djen.v1';

/**
 * Correção única dos textos já gravados (versões até 0.1.4): tira marcação de página e
 * acentos corrompidos de movimentações, alertas e processos. A identificação das
 * movimentações (fingerprint) não muda, para não gerar alertas repetidos.
 */
export async function fixStoredText(log: (m: string) => void) {
  const prisma = new PrismaClient();
  try {
    if (await prisma.setting.findUnique({ where: { key: KEY } })) return;
    let n = 0;
    const movements = await prisma.movement.findMany({ select: { id: true, description: true } });
    for (const m of movements) {
      if (!needsCleaning(m.description)) continue;
      await prisma.movement.update({ where: { id: m.id }, data: { description: cleanText(m.description) } });
      n++;
    }
    const alerts = await prisma.alert.findMany({ select: { id: true, title: true, message: true, data: true } });
    for (const a of alerts) {
      if (!needsCleaning(a.title) && !needsCleaning(a.message) && !needsCleaning(a.data)) continue;
      const data = a.data ? parseJson<unknown>(a.data, null) : null;
      await prisma.alert.update({
        where: { id: a.id },
        data: { title: cleanText(a.title), message: cleanText(a.message), data: data ? JSON.stringify(cleanDeep(data)) : a.data },
      });
      n++;
    }
    const processes = await prisma.process.findMany({ select: { id: true, organ: true, parties: true } });
    for (const p of processes) {
      if (!needsCleaning(p.organ) && !needsCleaning(p.parties)) continue;
      const parties = p.parties ? parseJson<unknown>(p.parties, null) : null;
      await prisma.process.update({ where: { id: p.id }, data: { organ: p.organ ? cleanText(p.organ) : p.organ, parties: parties ? JSON.stringify(cleanDeep(parties)) : p.parties } });
      n++;
    }
    await prisma.setting.create({ data: { key: KEY, value: new Date().toISOString() } });
    if (n) log(`Textos dos diários corrigidos: ${n} registro(s).`);
  } finally {
    await prisma.$disconnect();
  }
}
