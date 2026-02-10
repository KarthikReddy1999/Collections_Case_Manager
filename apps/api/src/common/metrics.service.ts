import { Injectable } from '@nestjs/common';
import { CaseStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private requestsTotal = 0;
  private readonly requestsByStatus: Record<string, number> = {};
  private readonly requestsByMethodPath: Record<string, number> = {};
  private assignmentRunsTotal = 0;
  private assignmentConflictsTotal = 0;
  private actionLogsCreatedTotal = 0;

  constructor(private readonly prisma: PrismaService) {}

  recordHttpRequest(input: { method: string; path: string; statusCode: number }) {
    this.requestsTotal += 1;

    const statusKey = String(input.statusCode);
    this.requestsByStatus[statusKey] = (this.requestsByStatus[statusKey] ?? 0) + 1;

    const methodPathKey = `${input.method} ${input.path}`;
    this.requestsByMethodPath[methodPathKey] = (this.requestsByMethodPath[methodPathKey] ?? 0) + 1;
  }

  incrementAssignmentRun() {
    this.assignmentRunsTotal += 1;
  }

  incrementAssignmentConflict() {
    this.assignmentConflictsTotal += 1;
  }

  incrementActionLogCreated() {
    this.actionLogsCreatedTotal += 1;
  }

  async getSnapshot() {
    const [totalCases, openCases, totalActionLogs, totalRuleDecisions] = await this.prisma.$transaction([
      this.prisma.collectionCase.count(),
      this.prisma.collectionCase.count({ where: { status: { in: [CaseStatus.OPEN, CaseStatus.IN_PROGRESS] } } }),
      this.prisma.actionLog.count(),
      this.prisma.ruleDecision.count(),
    ]);

    return {
      service: 'collections-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      http: {
        requestsTotal: this.requestsTotal,
        requestsByStatus: this.requestsByStatus,
        requestsByMethodPath: this.requestsByMethodPath,
      },
      business: {
        assignmentRunsTotal: this.assignmentRunsTotal,
        assignmentConflictsTotal: this.assignmentConflictsTotal,
        actionLogsCreatedTotal: this.actionLogsCreatedTotal,
      },
      db: {
        totalCases,
        openCases,
        totalActionLogs,
        totalRuleDecisions,
      },
    };
  }
}
