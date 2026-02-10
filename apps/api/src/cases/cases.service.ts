import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CaseStage, CaseStatus, Prisma } from '@prisma/client';
import { AddActionDto } from '../dto/add-action.dto';
import { AssignCaseDto } from '../dto/assign-case.dto';
import { CreateCaseDto } from '../dto/create-case.dto';
import { ListCasesDto } from '../dto/list-cases.dto';
import { PaginatedResponse } from '../common/api-response';
import { PrismaService } from '../common/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { RuleEngineService } from './rule-engine.service';
import { MetricsService } from '../common/metrics.service';

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: RuleEngineService,
    private readonly pdfService: PdfService,
    private readonly metricsService: MetricsService,
  ) {}

  async createCase(dto: CreateCaseDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }

    const loan = await this.prisma.loan.findUnique({ where: { id: dto.loanId } });
    if (!loan) {
      throw new NotFoundException(`Loan ${dto.loanId} not found`);
    }

    if (loan.customerId !== dto.customerId) {
      throw new BadRequestException('loanId does not belong to customerId');
    }

    const dpd = this.calculateDpd(loan.dueDate);
    this.log('info', 'case_create_started', {
      customerId: dto.customerId,
      loanId: dto.loanId,
      dpd,
    });

    const created = await this.prisma.collectionCase.create({
      data: {
        customerId: dto.customerId,
        loanId: dto.loanId,
        dpd,
        stage: this.getStageFromDpd(dpd),
        status: CaseStatus.OPEN,
      },
      include: {
        customer: true,
        loan: true,
      },
    });

    this.log('info', 'case_created', {
      caseId: created.id,
      customerId: created.customerId,
      loanId: created.loanId,
      stage: created.stage,
      status: created.status,
      dpd: created.dpd,
    });

    return created;
  }

  async listCases(filters: ListCasesDto): Promise<PaginatedResponse<Record<string, unknown>>> {
    if (filters.dpdMin !== undefined && filters.dpdMax !== undefined && filters.dpdMin > filters.dpdMax) {
      throw new BadRequestException('dpdMin cannot be greater than dpdMax');
    }

    const where: Prisma.CollectionCaseWhereInput = {
      status: filters.status,
      stage: filters.stage,
      assignedTo: filters.assignedTo,
      dpd: {
        gte: filters.dpdMin,
        lte: filters.dpdMax,
      },
    };

    const skip = (filters.page - 1) * filters.pageSize;
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.collectionCase.findMany({
        where,
        include: {
          customer: true,
          loan: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: filters.pageSize,
      }),
      this.prisma.collectionCase.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / filters.pageSize)),
      },
    };
  }

  async getKpis() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [openCasesCount, resolvedTodayCount, avgDpdData] = await this.prisma.$transaction([
      this.prisma.collectionCase.count({
        where: {
          status: {
            in: [CaseStatus.OPEN, CaseStatus.IN_PROGRESS],
          },
        },
      }),
      this.prisma.collectionCase.count({
        where: {
          status: CaseStatus.RESOLVED,
          updatedAt: { gte: startOfToday },
        },
      }),
      this.prisma.collectionCase.aggregate({
        where: {
          status: {
            in: [CaseStatus.OPEN, CaseStatus.IN_PROGRESS],
          },
        },
        _avg: {
          dpd: true,
        },
      }),
    ]);

    return {
      openCasesCount,
      resolvedTodayCount,
      averageDpdOpenCases: Number(avgDpdData._avg.dpd ?? 0).toFixed(2),
    };
  }

  async getCaseById(id: number) {
    const caseRecord = await this.prisma.collectionCase.findUnique({
      where: { id },
      include: {
        customer: true,
        loan: true,
        actionLogs: {
          orderBy: { createdAt: 'desc' },
        },
        ruleDecisions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!caseRecord) {
      throw new NotFoundException(`Case ${id} not found`);
    }

    return caseRecord;
  }

  async addAction(caseId: number, dto: AddActionDto) {
    await this.ensureCaseExists(caseId);

    const action = await this.prisma.actionLog.create({
      data: {
        caseId,
        type: dto.type,
        outcome: dto.outcome,
        notes: dto.notes,
      },
    });

    this.metricsService.incrementActionLogCreated();
    this.log('info', 'action_log_created', {
      caseId,
      actionId: action.id,
      type: action.type,
      outcome: action.outcome,
    });
    return action;
  }

  async assignCase(caseId: number, dto: AssignCaseDto = {}) {
    this.metricsService.incrementAssignmentRun();
    this.log('info', 'assignment_run_started', {
      caseId,
      expectedVersion: dto.expectedVersion ?? null,
    });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const caseRecord = await tx.collectionCase.findUnique({
          where: { id: caseId },
          include: {
            customer: true,
          },
        });

        if (!caseRecord) {
          throw new NotFoundException(`Case ${caseId} not found`);
        }

        if (dto.expectedVersion !== undefined && dto.expectedVersion !== caseRecord.version) {
          throw new ConflictException(
            `Assignment conflict: expectedVersion=${dto.expectedVersion}, currentVersion=${caseRecord.version}`,
          );
        }

        const decision = this.ruleEngine.evaluate({
          dpd: caseRecord.dpd,
          riskScore: caseRecord.customer.riskScore,
          currentStage: caseRecord.stage,
          currentAssignedTo: caseRecord.assignedTo,
        });

        this.log('info', 'assignment_decision_evaluated', {
          caseId,
          currentStage: caseRecord.stage,
          currentAssignedTo: caseRecord.assignedTo,
          currentStatus: caseRecord.status,
          currentVersion: caseRecord.version,
          nextStage: decision.stage,
          nextAssignedTo: decision.assignedTo,
          matchedRules: decision.matchedRules,
        });

        const shouldUpdateCase =
          caseRecord.stage !== decision.stage ||
          caseRecord.assignedTo !== decision.assignedTo ||
          caseRecord.status !== CaseStatus.IN_PROGRESS;

        let version = caseRecord.version;

        if (shouldUpdateCase) {
          const updated = await tx.collectionCase.updateMany({
            where: {
              id: caseId,
              version: caseRecord.version,
            },
            data: {
              stage: decision.stage,
              assignedTo: decision.assignedTo,
              status: CaseStatus.IN_PROGRESS,
              version: { increment: 1 },
            },
          });

          if (updated.count === 0) {
            throw new ConflictException('Assignment conflict: case was modified by another process');
          }

          version = caseRecord.version + 1;
          this.log('info', 'assignment_state_updated', {
            caseId,
            fromVersion: caseRecord.version,
            toVersion: version,
            stage: decision.stage,
            assignedTo: decision.assignedTo,
          });
        } else {
          this.log('info', 'assignment_state_unchanged', {
            caseId,
            version,
            stage: decision.stage,
            assignedTo: decision.assignedTo,
          });
        }

        const auditReason = shouldUpdateCase ? decision.reason : `${decision.reason}; no case field changes`;

        await tx.ruleDecision.create({
          data: {
            caseId,
            matchedRules: decision.matchedRules,
            reason: auditReason,
          },
        });

        return {
          caseId: caseRecord.id,
          stage: decision.stage,
          assignedTo: decision.assignedTo,
          version,
          decision: {
            matchedRules: decision.matchedRules,
            reason: auditReason,
          },
        };
      });

      this.log('info', 'assignment_run_completed', {
        caseId,
        version: result.version,
        stage: result.stage,
        assignedTo: result.assignedTo,
        matchedRules: result.decision.matchedRules,
      });
      return result;
    } catch (error) {
      if (error instanceof ConflictException) {
        this.metricsService.incrementAssignmentConflict();
        this.log('warn', 'assignment_conflict', {
          caseId,
          expectedVersion: dto.expectedVersion ?? null,
          message: error.message,
        });
      } else {
        this.log('error', 'assignment_failed', {
          caseId,
          expectedVersion: dto.expectedVersion ?? null,
          message: (error as Error).message ?? 'Unknown error',
        });
      }
      throw error;
    }
  }

  async generateNoticePdf(caseId: number) {
    const caseRecord = await this.prisma.collectionCase.findUnique({
      where: { id: caseId },
      include: {
        customer: true,
        loan: true,
        actionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    });

    if (!caseRecord) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    try {
      const pdf = await this.pdfService.generatePaymentNotice({
        caseData: caseRecord,
        customer: caseRecord.customer,
        loan: caseRecord.loan,
        lastActions: caseRecord.actionLogs,
      });
      this.log('info', 'pdf_notice_generated', {
        caseId,
        bytes: pdf.length,
        actionCount: caseRecord.actionLogs.length,
      });
      return pdf;
    } catch (error) {
      this.log('error', 'pdf_notice_generation_failed', {
        caseId,
        message: (error as Error).message ?? 'Unknown error',
      });
      throw new InternalServerErrorException(`Failed to generate PDF: ${(error as Error).message}`);
    }
  }

  private async ensureCaseExists(caseId: number) {
    const exists = await this.prisma.collectionCase.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }
  }

  private calculateDpd(dueDate: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const diff = Math.floor((Date.now() - dueDate.getTime()) / msPerDay);
    return Math.max(0, diff);
  }

  private getStageFromDpd(dpd: number): CaseStage {
    if (dpd > 30) {
      return CaseStage.LEGAL;
    }

    if (dpd >= 8) {
      return CaseStage.HARD;
    }

    return CaseStage.SOFT;
  }

  private log(level: 'info' | 'warn' | 'error', event: string, meta: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        level,
        event,
        component: 'CasesService',
        timestamp: new Date().toISOString(),
        ...meta,
      }),
    );
  }
}
