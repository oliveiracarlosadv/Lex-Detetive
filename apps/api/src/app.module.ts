import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { AccessController } from './auth/access.controller';
import { AccessService } from './auth/access.service';
import { ClientsController } from './clients/clients.controller';
import { ClientsService } from './clients/clients.service';
import { JWT_SECRET } from './config';
import { ConnectorsService } from './connectors/connectors.service';
import { MailController } from './mail/mail.controller';
import { MailService } from './mail/mail.service';
import { MonitoringService } from './monitoring/monitoring.service';
import { PrismaService } from './prisma.service';
import { ReportsController } from './reports/reports.controller';
import { AuditService } from './system/audit.service';
import { BackupService } from './system/backup.service';
import { SettingsService } from './system/settings.service';
import { SystemController } from './system/system.controller';
import { DashboardController } from './targets/dashboard.controller';
import { TargetsController } from './targets/targets.controller';
import { TargetsService } from './targets/targets.service';

/** Interface web exportada pelo Next.js (apps/web → apps/api/public). */
const WEB_ROOT = join(__dirname, '..', 'public');

@Module({
  imports: [
    ScheduleModule.forRoot(),
    JwtModule.register({ global: true, secret: JWT_SECRET, signOptions: { expiresIn: '12h' } }),
    ...(existsSync(WEB_ROOT) ? [ServeStaticModule.forRoot({
      rootPath: WEB_ROOT, exclude: ['/api/{*path}'],
      // Arquivos com hash ficam em cache permanente: telas abrem sem reler o disco nem recompilar scripts.
      serveStaticOptions: { setHeaders: (res: any, file: string) => res.setHeader('Cache-Control', /[\\/]_next[\\/]static[\\/]/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache') },
    })] : []),
  ],
  controllers: [AuthController, AccessController, ClientsController, MailController, TargetsController, DashboardController, AiController, ReportsController, SystemController],
  providers: [
    PrismaService, AuditService, SettingsService, AuthService, ConnectorsService, TargetsService, MonitoringService, AiService, ClientsService, MailService, BackupService, AccessService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
