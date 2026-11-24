import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Auditoria');
  constructor(private prisma: PrismaService) {}

  async log(entry: { userId?: string | null; action: string; entity?: string; entityId?: string; details?: unknown; ip?: string }) {
    this.logger.log(`${entry.action}${entry.entity ? ` ${entry.entity}` : ''}${entry.entityId ? `#${entry.entityId}` : ''}`);
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details === undefined ? null : JSON.stringify(entry.details),
        ip: entry.ip,
      },
    });
  }

  list(limit = 200) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { name: true, email: true } } },
    });
  }
}
