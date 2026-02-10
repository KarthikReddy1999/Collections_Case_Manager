import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { PrismaService } from '../common/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { RuleEngineService } from './rule-engine.service';
import { MetricsController } from '../metrics/metrics.controller';
import { MetricsService } from '../common/metrics.service';

@Module({
  controllers: [CasesController, MetricsController],
  providers: [CasesService, PrismaService, PdfService, RuleEngineService, MetricsService],
  exports: [MetricsService],
})
export class CasesModule {}
