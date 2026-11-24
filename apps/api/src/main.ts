import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DATA_DIR, HOST, PORT } from './config';
import { AppModule } from './app.module';
import { migrate } from './migrate';
import { fixStoredText } from './system/text-fix';

async function bootstrap() {
  const log = new Logger('Lex Detetive');
  await migrate((m) => log.log(m));
  await fixStoredText((m) => log.log(m)).catch((e) => log.warn(`Correção de textos não concluída: ${e.message}`));
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'warn', 'error'] });
  app.disable('x-powered-by');
  app.use((_req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  // Em desenvolvimento, o Next.js roda na porta 3000.
  app.enableCors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'tauri://localhost'], exposedHeaders: ['Content-Disposition', 'X-Integrity-SHA256'] });
  app.useBodyParser('json', { limit: '2mb' });
  await app.listen(PORT, HOST);
  log.log(`Rodando em http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  log.log(`Dados locais em ${DATA_DIR}`);
}
bootstrap();
