-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'DELINQUENT', 'CLOSED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "CaseStage" AS ENUM ('SOFT', 'HARD', 'LEGAL');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CALL', 'SMS', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ActionOutcome" AS ENUM ('NO_ANSWER', 'PROMISE_TO_PAY', 'PAID', 'WRONG_NUMBER');

-- CreateTable
CREATE TABLE "customers" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "riskScore" INTEGER NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
  "id" SERIAL NOT NULL,
  "customerId" INTEGER NOT NULL,
  "principal" DECIMAL(14,2) NOT NULL,
  "outstanding" DECIMAL(14,2) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
  "id" SERIAL NOT NULL,
  "customerId" INTEGER NOT NULL,
  "loanId" INTEGER NOT NULL,
  "dpd" INTEGER NOT NULL,
  "stage" "CaseStage" NOT NULL DEFAULT 'SOFT',
  "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
  "assignedTo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_logs" (
  "id" SERIAL NOT NULL,
  "caseId" INTEGER NOT NULL,
  "type" "ActionType" NOT NULL,
  "outcome" "ActionOutcome" NOT NULL,
  "notes" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_decisions" (
  "id" SERIAL NOT NULL,
  "caseId" INTEGER NOT NULL,
  "matchedRules" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rule_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "loans_customerId_idx" ON "loans"("customerId");

-- CreateIndex
CREATE INDEX "cases_status_stage_dpd_idx" ON "cases"("status", "stage", "dpd");

-- CreateIndex
CREATE INDEX "cases_assignedTo_idx" ON "cases"("assignedTo");

-- CreateIndex
CREATE INDEX "cases_customerId_idx" ON "cases"("customerId");

-- CreateIndex
CREATE INDEX "cases_loanId_idx" ON "cases"("loanId");

-- CreateIndex
CREATE INDEX "action_logs_caseId_createdAt_idx" ON "action_logs"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "rule_decisions_caseId_createdAt_idx" ON "rule_decisions"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_loanId_fkey"
FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_decisions" ADD CONSTRAINT "rule_decisions_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
