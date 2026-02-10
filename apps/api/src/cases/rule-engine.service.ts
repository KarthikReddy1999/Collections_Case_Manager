import { Injectable } from '@nestjs/common';
import { CaseStage } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

type NumericCondition = {
  min?: number;
  max?: number;
  gt?: number;
};

type AssignmentRule = {
  name: string;
  when: {
    dpd?: NumericCondition;
    riskScore?: NumericCondition;
  };
  then: {
    stage?: CaseStage;
    assignGroup?: string;
    assignedTo?: string;
    override?: boolean;
  };
};

export interface AssignmentDecision {
  stage: CaseStage;
  assignedTo: string | null;
  matchedRules: string[];
  reason: string;
}

@Injectable()
export class RuleEngineService {
  private readonly rules: AssignmentRule[];

  constructor() {
    const rulesFile = path.join(process.cwd(), 'src', 'config', 'rules.json');
    this.rules = JSON.parse(fs.readFileSync(rulesFile, 'utf-8')) as AssignmentRule[];
  }

  evaluate(input: {
    dpd: number;
    riskScore: number;
    currentStage: CaseStage;
    currentAssignedTo: string | null;
  }): AssignmentDecision {
    let stage = input.currentStage;
    let assignedTo = input.currentAssignedTo;
    const matchedRules: string[] = [];
    const reasonParts: string[] = [];

    for (const rule of this.rules) {
      if (!this.matchesRule(rule, input)) {
        continue;
      }

      matchedRules.push(rule.name);

      if (rule.then.stage) {
        stage = rule.then.stage;
      }

      if (rule.then.assignGroup) {
        assignedTo = rule.then.assignGroup;
      }

      if (rule.then.override && rule.then.assignedTo) {
        assignedTo = rule.then.assignedTo;
      }

      if (rule.name.startsWith('DPD')) {
        reasonParts.push(`dpd=${input.dpd} -> ${rule.then.assignGroup ?? stage}`);
      } else if (rule.name.startsWith('RISK')) {
        const suffix = rule.then.override ? ' override' : '';
        reasonParts.push(`riskScore=${input.riskScore} -> ${rule.then.assignedTo ?? assignedTo}${suffix}`);
      } else {
        reasonParts.push(rule.name);
      }
    }

    return {
      stage,
      assignedTo,
      matchedRules,
      reason: reasonParts.length > 0 ? reasonParts.join('; ') : 'No rules matched; assignment unchanged',
    };
  }

  private matchesRule(rule: AssignmentRule, input: { dpd: number; riskScore: number }) {
    const dpdMatch = this.matchesNumericCondition(rule.when.dpd, input.dpd);
    const riskMatch = this.matchesNumericCondition(rule.when.riskScore, input.riskScore);

    return dpdMatch && riskMatch;
  }

  private matchesNumericCondition(condition: NumericCondition | undefined, value: number) {
    if (!condition) {
      return true;
    }

    if (condition.min !== undefined && value < condition.min) {
      return false;
    }

    if (condition.max !== undefined && value > condition.max) {
      return false;
    }

    if (condition.gt !== undefined && value <= condition.gt) {
      return false;
    }

    return true;
  }
}
