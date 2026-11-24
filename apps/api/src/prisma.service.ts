import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    // WAL + gravação NORMAL: menos escrita em disco; cache de 8 MB; temporários em memória.
    for (const p of ['journal_mode = WAL', 'synchronous = NORMAL', 'temp_store = MEMORY', 'cache_size = -8000']) {
      await this.$queryRawUnsafe(`PRAGMA ${p};`).catch(() => undefined);
    }
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
