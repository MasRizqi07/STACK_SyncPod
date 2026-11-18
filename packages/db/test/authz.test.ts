import { beforeAll, describe, expect, it } from 'vitest';
import { AuthzError, assertPodLeader, assertPodMember, db } from '../src/index.js';

describe('database authorization helpers assertPodMember & assertPodLeader (3.8)', () => {
  let podId: string;
  let leaderId: string;
  let memberId: string;
  let outsiderId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    const course = await db.course.create({
      data: {
        code: `AUTHZ-${suffix}`,
        title: 'Authz Verification Course',
      },
    });
    const mod = await db.module.create({
      data: {
        courseId: course.id,
        title: 'Authz Leaf Module',
        isLeaf: true,
      },
    });

    const [leader, member, outsider] = await Promise.all([
      db.user.create({
        data: { email: `leader-${suffix}@test.local`, name: 'Pod Leader' },
      }),
      db.user.create({
        data: { email: `member-${suffix}@test.local`, name: 'Pod Member' },
      }),
      db.user.create({
        data: { email: `outsider-${suffix}@test.local`, name: 'Pod Outsider' },
      }),
    ]);

    leaderId = leader.id;
    memberId = member.id;
    outsiderId = outsider.id;

    const pod = await db.sprintPod.create({
      data: {
        moduleId: mod.id,
        focusDurationSec: 1500,
        breakDurationSec: 300,
        members: {
          create: [
            { userId: leaderId, role: 'LEADER' },
            { userId: memberId, role: 'MEMBER' },
          ],
        },
      },
    });

    podId = pod.id;
  });

  it('allows pod member and leader through assertPodMember', async () => {
    const m1 = await assertPodMember(leaderId, podId);
    expect(m1.role).toBe('LEADER');

    const m2 = await assertPodMember(memberId, podId);
    expect(m2.role).toBe('MEMBER');
  });

  it('throws NOT_A_MEMBER for non-member on assertPodMember and assertPodLeader', async () => {
    await expect(assertPodMember(outsiderId, podId)).rejects.toMatchObject({
      name: 'AuthzError',
      code: 'NOT_A_MEMBER',
    });

    await expect(assertPodLeader(outsiderId, podId)).rejects.toMatchObject({
      name: 'AuthzError',
      code: 'NOT_A_MEMBER',
    });
  });

  it('throws FORBIDDEN for non-leader member on assertPodLeader, and allows leader', async () => {
    await expect(assertPodLeader(memberId, podId)).rejects.toMatchObject({
      name: 'AuthzError',
      code: 'FORBIDDEN',
    });

    const leaderMembership = await assertPodLeader(leaderId, podId);
    expect(leaderMembership.userId).toBe(leaderId);
    expect(leaderMembership.role).toBe('LEADER');
  });

  it('throws POD_NOT_FOUND when pod does not exist', async () => {
    await expect(assertPodMember(leaderId, 'non-existent-pod-id')).rejects.toBeInstanceOf(
      AuthzError,
    );
    await expect(assertPodMember(leaderId, 'non-existent-pod-id')).rejects.toMatchObject({
      code: 'POD_NOT_FOUND',
    });
    await expect(assertPodLeader(leaderId, 'non-existent-pod-id')).rejects.toMatchObject({
      code: 'POD_NOT_FOUND',
    });
  });
});
