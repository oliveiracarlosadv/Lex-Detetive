import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { AuditService } from '../system/audit.service';
import { AiService } from './ai.service';
import { ProviderId } from './providers';

@Controller('api/ai')
export class AiController {
  constructor(private ai: AiService, private audit: AuditService) {}

  @Get('providers')
  providers() {
    return this.ai.providers();
  }

  @Get('hardware')
  hardware() {
    return this.ai.hardware();
  }

  @Get('models')
  models(@Query('provider') provider: ProviderId) {
    return this.ai.models(provider);
  }

  @Post('test')
  test(@Body() body: { provider?: ProviderId }) {
    return this.ai.test(body.provider);
  }

  @Post('processes/:id/analyze')
  async analyzeProcess(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { useAi?: boolean }) {
    const r = await this.ai.analyzeProcess(id, body?.useAi !== false);
    await this.audit.log({ userId: user.id, action: 'ia.analise_processo', entity: 'Process', entityId: id, details: { provider: r.provider } });
    return r;
  }

  @Post('targets/:id/analyze')
  async analyzeTarget(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { useAi?: boolean }) {
    const r = await this.ai.analyzeTarget(id, body?.useAi !== false);
    await this.audit.log({ userId: user.id, action: 'ia.parecer_alvo', entity: 'Target', entityId: id, details: { provider: r.provider } });
    return r;
  }

  @Post('compose')
  async compose(@CurrentUser() user: AuthUser, @Body() body: { mode: string; instruction?: string; html?: string; subject?: string; processId?: string; clientId?: string; recipientName?: string }) {
    const r = await this.ai.compose(body);
    await this.audit.log({ userId: user.id, action: 'ia.redacao_email', details: { mode: body.mode, provider: r.provider } });
    return r;
  }
}
