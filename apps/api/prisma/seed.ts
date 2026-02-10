import { PrismaClient, LoanStatus, CaseStatus, CaseStage, ActionOutcome, ActionType } from '@prisma/client';

const prisma = new PrismaClient();

function getDpd(dueDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.floor((Date.now() - dueDate.getTime()) / msPerDay);
  return Math.max(0, diff);
}

async function main() {
  const existingCustomers = await prisma.customer.count();
  if (existingCustomers > 0) {
    return;
  }

  const customers = await prisma.$transaction([
    prisma.customer.create({
      data: {
        name: 'Anita Rao',
        phone: '+1-555-0101',
        email: 'anita.rao@example.com',
        country: 'US',
        riskScore: 45,
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Carlos Mendez',
        phone: '+1-555-0102',
        email: 'carlos.mendez@example.com',
        country: 'US',
        riskScore: 92,
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Mina Khan',
        phone: '+1-555-0103',
        email: 'mina.khan@example.com',
        country: 'US',
        riskScore: 78,
      },
    }),
  ]);

  const dueDate1 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const dueDate2 = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
  const dueDate3 = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

  const loans = await prisma.$transaction([
    prisma.loan.create({
      data: {
        customerId: customers[0].id,
        principal: 8000,
        outstanding: 3200,
        dueDate: dueDate1,
        status: LoanStatus.DELINQUENT,
      },
    }),
    prisma.loan.create({
      data: {
        customerId: customers[1].id,
        principal: 16000,
        outstanding: 9600,
        dueDate: dueDate2,
        status: LoanStatus.DELINQUENT,
      },
    }),
    prisma.loan.create({
      data: {
        customerId: customers[2].id,
        principal: 12000,
        outstanding: 12000,
        dueDate: dueDate3,
        status: LoanStatus.DELINQUENT,
      },
    }),
  ]);

  const cases = await prisma.$transaction([
    prisma.collectionCase.create({
      data: {
        customerId: customers[0].id,
        loanId: loans[0].id,
        dpd: getDpd(dueDate1),
        stage: CaseStage.SOFT,
        status: CaseStatus.OPEN,
        assignedTo: 'Tier1',
      },
    }),
    prisma.collectionCase.create({
      data: {
        customerId: customers[1].id,
        loanId: loans[1].id,
        dpd: getDpd(dueDate2),
        stage: CaseStage.HARD,
        status: CaseStatus.IN_PROGRESS,
        assignedTo: 'SeniorAgent',
      },
    }),
    prisma.collectionCase.create({
      data: {
        customerId: customers[2].id,
        loanId: loans[2].id,
        dpd: getDpd(dueDate3),
        stage: CaseStage.LEGAL,
        status: CaseStatus.OPEN,
        assignedTo: 'Legal',
      },
    }),
  ]);

  await prisma.actionLog.createMany({
    data: [
      {
        caseId: cases[0].id,
        type: ActionType.CALL,
        outcome: ActionOutcome.NO_ANSWER,
        notes: 'No pickup at 10am',
      },
      {
        caseId: cases[1].id,
        type: ActionType.WHATSAPP,
        outcome: ActionOutcome.PROMISE_TO_PAY,
        notes: 'Customer promised Friday payment',
      },
      {
        caseId: cases[2].id,
        type: ActionType.EMAIL,
        outcome: ActionOutcome.WRONG_NUMBER,
        notes: 'Email bounced, wrong contact details',
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
