import { describe, expect, it } from 'vitest';
import { db } from '../src/index.js';

describe('db singleton', () => {
  it('exports a valid PrismaClient singleton with all model delegates', () => {
    expect(db).toBeDefined();
    expect(typeof db.user.findMany).toBe('function');
    expect(typeof db.course.findMany).toBe('function');
    expect(typeof db.module.findMany).toBe('function');
    expect(typeof db.matchRequest.findMany).toBe('function');
    expect(typeof db.sprintPod.findMany).toBe('function');
    expect(typeof db.podMember.findMany).toBe('function');
    expect(typeof db.question.findMany).toBe('function');
    expect(typeof db.endorsement.findMany).toBe('function');
  });

  it('persists singleton reference on globalThis in non-production environments', () => {
    const globalObj = globalThis as unknown as { prisma?: unknown };
    expect(globalObj.prisma).toBe(db);
  });

  it('executes a query against the test database successfully', async () => {
    const count = await db.user.count();
    expect(typeof count).toBe('number');
  });
});
