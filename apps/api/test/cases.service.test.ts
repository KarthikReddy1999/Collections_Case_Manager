import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ConflictException } from '@nestjs/common';
import { CasesService } from '../src/cases/cases.service';

function createMetricsSpy() {
  const state = {
    assignmentRuns: 0,
    assignmentConflicts: 0,
    actionLogsCreated: 0,
  };

  return {
    state,
    incrementAssignmentRun() {
      state.assignmentRuns += 1;
    },
    incrementAssignmentConflict() {
      state.assignmentConflicts += 1;
    },
    incrementActionLogCreated() {
      state.actionLogsCreated += 1;
    },
  };
}

test('assignCase keeps version stable when assignment fields are unchanged and still writes audit per run', async () => {
  const audits: Array<{ caseId: number; matchedRules: string[]; reason: string }> = [];

  const tx = {
    collectionCase: {
      findUnique: async () => ({
        id: 3,
        dpd: 40,
        stage: 'LEGAL',
        assignedTo: 'Legal',
        status: 'IN_PROGRESS',
        version: 2,
        customer: { riskScore: 78 },
      }),
      updateMany: async () => {
        throw new Error('updateMany should not run when no case field changes');
      },
    },
    ruleDecision: {
      create: async ({ data }: { data: { caseId: number; matchedRules: string[]; reason: string } }) => {
        audits.push(data);
        return { id: audits.length, ...data };
      },
    },
  };

  const prisma = {
    $transaction: async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const ruleEngine = {
    evaluate: () => ({
      stage: 'LEGAL',
      assignedTo: 'Legal',
      matchedRules: ['DPD_GT_30'],
      reason: 'dpd=40 -> Legal',
    }),
  };
  const metrics = createMetricsSpy();

  const service = new CasesService(prisma as never, ruleEngine as never, {} as never, metrics as never);

  const first = await service.assignCase(3, { expectedVersion: 2 });
  const second = await service.assignCase(3, { expectedVersion: 2 });

  assert.equal(first.version, 2);
  assert.equal(second.version, 2);
  assert.equal(audits.length, 2);
  assert.equal(audits[0].reason, 'dpd=40 -> Legal; no case field changes');
  assert.equal(audits[1].reason, 'dpd=40 -> Legal; no case field changes');
  assert.equal(metrics.state.assignmentRuns, 2);
  assert.equal(metrics.state.assignmentConflicts, 0);
});

test('assignCase throws conflict for stale expectedVersion and increments conflict metric', async () => {
  const tx = {
    collectionCase: {
      findUnique: async () => ({
        id: 3,
        dpd: 40,
        stage: 'LEGAL',
        assignedTo: 'Legal',
        status: 'IN_PROGRESS',
        version: 5,
        customer: { riskScore: 78 },
      }),
    },
    ruleDecision: {
      create: async () => {
        throw new Error('audit write should not happen on stale expectedVersion');
      },
    },
  };

  const prisma = {
    $transaction: async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const ruleEngine = {
    evaluate: () => {
      throw new Error('rule engine should not run on stale expectedVersion');
    },
  };
  const metrics = createMetricsSpy();

  const service = new CasesService(prisma as never, ruleEngine as never, {} as never, metrics as never);

  await assert.rejects(
    () => service.assignCase(3, { expectedVersion: 4 }),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.match((error as Error).message, /expectedVersion=4/);
      return true;
    },
  );

  assert.equal(metrics.state.assignmentRuns, 1);
  assert.equal(metrics.state.assignmentConflicts, 1);
});

test('assignCase updates case and increments version when decision changes state', async () => {
  const auditWrites: Array<{ reason: string }> = [];
  const updateManyCalls: Array<unknown> = [];

  const tx = {
    collectionCase: {
      findUnique: async () => ({
        id: 2,
        dpd: 12,
        stage: 'SOFT',
        assignedTo: 'Tier1',
        status: 'OPEN',
        version: 1,
        customer: { riskScore: 92 },
      }),
      updateMany: async (args: unknown) => {
        updateManyCalls.push(args);
        return { count: 1 };
      },
    },
    ruleDecision: {
      create: async ({ data }: { data: { reason: string } }) => {
        auditWrites.push(data);
        return { id: 1, ...data };
      },
    },
  };

  const prisma = {
    $transaction: async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const ruleEngine = {
    evaluate: () => ({
      stage: 'HARD',
      assignedTo: 'SeniorAgent',
      matchedRules: ['DPD_8_30', 'RISK_GT_80_OVERRIDE'],
      reason: 'dpd=12 -> Tier2; riskScore=92 -> SeniorAgent override',
    }),
  };
  const metrics = createMetricsSpy();

  const service = new CasesService(prisma as never, ruleEngine as never, {} as never, metrics as never);
  const result = await service.assignCase(2, { expectedVersion: 1 });

  assert.equal(result.version, 2);
  assert.equal(result.stage, 'HARD');
  assert.equal(result.assignedTo, 'SeniorAgent');
  assert.equal(updateManyCalls.length, 1);
  assert.equal(auditWrites.length, 1);
  assert.equal(auditWrites[0].reason, 'dpd=12 -> Tier2; riskScore=92 -> SeniorAgent override');
  assert.equal(metrics.state.assignmentRuns, 1);
  assert.equal(metrics.state.assignmentConflicts, 0);
});

test('addAction writes action log and increments action metric', async () => {
  const prisma = {
    collectionCase: {
      findUnique: async () => ({ id: 3 }),
    },
    actionLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 99, ...data }),
    },
  };
  const metrics = createMetricsSpy();

  const service = new CasesService(prisma as never, {} as never, {} as never, metrics as never);
  const result = await service.addAction(3, {
    type: 'CALL',
    outcome: 'PROMISE_TO_PAY',
    notes: 'Customer promised to pay on Friday',
  });

  assert.equal(result.id, 99);
  assert.equal(result.caseId, 3);
  assert.equal(result.type, 'CALL');
  assert.equal(metrics.state.actionLogsCreated, 1);
});
