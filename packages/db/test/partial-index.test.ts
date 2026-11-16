import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { PrismaClient, Urgency, MatchStatus } from '@prisma/client';

describe('partial unique index one_waiting_per_user', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects a second WAITING MatchRequest for the same user, but allows multiple CANCELLED requests', async () => {
    // 1. Create a user
    const user = await prisma.user.create({
      data: {
        email: `test-user-${Date.now()}@example.local`,
        name: 'Test Candidate',
      },
    });

    // 2. Create course and module
    const course = await prisma.course.create({
      data: {
        code: `CS-${Date.now()}`,
        title: 'Algorithms and Data Structures',
      },
    });

    const module = await prisma.module.create({
      data: {
        courseId: course.id,
        title: 'Binary Search Trees',
        isLeaf: true,
      },
    });

    const now = new Date();
    const future = new Date(Date.now() + 25 * 60 * 1000);

    // 3. First WAITING request succeeds
    const firstWaiting = await prisma.matchRequest.create({
      data: {
        userId: user.id,
        moduleId: module.id,
        urgency: Urgency.QUIZ_PREP,
        windowStart: now,
        windowEnd: future,
        status: MatchStatus.WAITING,
      },
    });
    expect(firstWaiting.id).toBeDefined();

    // 4. Second WAITING request for the same user fails with unique violation (P2002)
    let secondWaitingFailed = false;
    try {
      await prisma.matchRequest.create({
        data: {
          userId: user.id,
          moduleId: module.id,
          urgency: Urgency.THEORY_REVIEW,
          windowStart: now,
          windowEnd: future,
          status: MatchStatus.WAITING,
        },
      });
    } catch (err: unknown) {
      secondWaitingFailed = true;
      expect((err as { code?: string }).code).toBe('P2002');
    }
    expect(secondWaitingFailed).toBe(true);

    // 5. Update first request to CANCELLED or insert multiple CANCELLED requests
    const firstCancelled = await prisma.matchRequest.create({
      data: {
        userId: user.id,
        moduleId: module.id,
        urgency: Urgency.STUCK_ASSIGNMENT,
        windowStart: now,
        windowEnd: future,
        status: MatchStatus.CANCELLED,
      },
    });
    expect(firstCancelled.id).toBeDefined();

    const secondCancelled = await prisma.matchRequest.create({
      data: {
        userId: user.id,
        moduleId: module.id,
        urgency: Urgency.QUIZ_PREP,
        windowStart: now,
        windowEnd: future,
        status: MatchStatus.CANCELLED,
      },
    });
    expect(secondCancelled.id).toBeDefined();
  });
});
