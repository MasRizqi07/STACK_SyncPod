import { describe, expect, it } from 'vitest';
import { db } from '../src/index.js';
import { seed, DEMO_USERS, BOT_USERS } from '../src/seed.js';

describe('database seed idempotency and constraints (3.3)', () => {
  it('executes idempotently without changing row counts', async () => {
    const run1 = await seed();
    const run2 = await seed();

    expect(run1.courses).toBeGreaterThanOrEqual(3);
    expect(run1.modules).toBeGreaterThanOrEqual(15);
    expect(run1.users).toBeGreaterThanOrEqual(7);

    expect(run2.courses).toBe(run1.courses);
    expect(run2.modules).toBe(run1.modules);
    expect(run2.users).toBe(run1.users);

    const seededCourses = await db.course.findMany({
      where: { code: { in: ['IF201', 'MA202', 'IF304'] } },
    });
    expect(seededCourses.length).toBe(3);

    const seededUsers = await db.user.findMany({
      where: { email: { contains: 'syncpod.local' } },
    });
    expect(seededUsers.length).toBe(7);
  });

  it('contains 4 fictional demo accounts aligned with demo constants', async () => {
    for (const demoUser of DEMO_USERS) {
      const user = await db.user.findUnique({
        where: { email: demoUser.email },
      });
      expect(user).toBeDefined();
      expect(user?.name).toBe(demoUser.name);
      expect(user?.email).toMatch(/^demo-[1-4]@demo\.syncpod\.local$/);
    }
  });

  it('contains 3 bot accounts with @bot.syncpod.local domain (D8)', async () => {
    for (const botUser of BOT_USERS) {
      const bot = await db.user.findUnique({
        where: { email: botUser.email },
      });
      expect(bot).toBeDefined();
      expect(bot?.name).toBe(botUser.name);
      expect(bot?.email).toMatch(/^simulasi-[1-3]@bot\.syncpod\.local$/);
    }
  });

  it('contains zero real student emails and zero student NPM (D8, D10)', async () => {
    const seededUsers = await db.user.findMany({
      where: { email: { contains: 'syncpod.local' } },
    });
    for (const u of seededUsers) {
      // Must not contain @mhs.itats.ac.id or real personal email domains
      expect(u.email).not.toContain('@mhs.itats.ac.id');
      expect(u.email).not.toContain('@gmail.com');
      // Email username must not contain numeric student ID / NPM pattern (e.g. 06.2021...)
      expect(u.email).not.toMatch(/\d{5,}/);
    }
  });

  it('contains leaf modules from syllabus fixture including Dijkstra', async () => {
    const dijkstra = await db.module.findUnique({
      where: { id: 'mod-dijkstra' },
      include: { course: true },
    });
    expect(dijkstra).toBeDefined();
    expect(dijkstra?.isLeaf).toBe(true);
    expect(dijkstra?.title).toBe('Traversal Graf dan Dijkstra');
    expect(dijkstra?.course.code).toBe('IF201');
  });
});
