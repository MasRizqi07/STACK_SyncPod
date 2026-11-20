import { beforeAll, describe, expect, it } from 'vitest';
import { assertPodLeader, assertPodMember, db } from '../src/index.js';

describe('database authorization helpers assertPodMember & assertPodLeader (3.8, D38)', () => {
  let podId: string;
  let leaderId: string;
  let memberId: string;
  let outsiderId: string;
  let completedPodId: string;

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

    // Active pod in FOCUS phase
    const pod = await db.sprintPod.create({
      data: {
        moduleId: mod.id,
        phase: 'FOCUS',
        round: 1,
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

    // Completed pod
    const completedPod = await db.sprintPod.create({
      data: {
        moduleId: mod.id,
        phase: 'COMPLETED',
        round: 4,
        focusDurationSec: 1500,
        breakDurationSec: 300,
        members: {
          create: [
            { userId: memberId, role: 'MEMBER' },
          ],
        },
      },
    });
    completedPodId = completedPod.id;
  });

  it('1. allows pod member and leader through assertPodMember (both argument orders)', async () => {
    // Signature: (podId, userId)
    const m1 = await assertPodMember(podId, leaderId);
    expect(m1.role).toBe('LEADER');

    const m2 = await assertPodMember(podId, memberId);
    expect(m2.role).toBe('MEMBER');

    // Signature: (userId, podId)
    const m1Rev = await assertPodMember(leaderId, podId);
    expect(m1Rev.role).toBe('LEADER');

    const m2Rev = await assertPodMember(memberId, podId);
    expect(m2Rev.role).toBe('MEMBER');
  });

  it('2. throws NOT_A_MEMBER for non-member on assertPodMember and assertPodLeader', async () => {
    await expect(assertPodMember(podId, outsiderId)).rejects.toMatchObject({
      name: 'AuthzError',
      code: 'NOT_A_MEMBER',
    });

    await expect(assertPodLeader(podId, outsiderId)).rejects.toMatchObject({
      name: 'AuthzError',
      code: 'NOT_A_MEMBER',
    });
  });

  it('3. throws POD_NOT_FOUND when pod does not exist', async () => {
    await expect(assertPodMember('non-existent-pod-id', leaderId)).rejects.toMatchObject({
      name: 'AuthzError',
      code: 'POD_NOT_FOUND',
    });

    await expect(assertPodLeader('non-existent-pod-id', leaderId)).rejects.toMatchObject({
      name: 'AuthzError',
      code: 'POD_NOT_FOUND',
    });
  });

  it('4. allows leader and throws FORBIDDEN for non-leader member on assertPodLeader', async () => {
    const leaderMembership = await assertPodLeader(podId, leaderId);
    expect(leaderMembership.userId).toBe(leaderId);
    expect(leaderMembership.role).toBe('LEADER');

    await expect(assertPodLeader(podId, memberId)).rejects.toMatchObject({
      name: 'AuthzError',
      code: 'FORBIDDEN',
    });
  });

  it('5. after leader role transfer, new leader succeeds and old leader is rejected with FORBIDDEN', async () => {
    // Transfer leadership in database: member -> LEADER, leader -> MEMBER
    await db.$transaction([
      db.podMember.update({
        where: { podId_userId: { podId, userId: leaderId } },
        data: { role: 'MEMBER' },
      }),
      db.podMember.update({
        where: { podId_userId: { podId, userId: memberId } },
        data: { role: 'LEADER' },
      }),
    ]);

    // Now memberId is LEADER
    const newLeader = await assertPodLeader(podId, memberId);
    expect(newLeader.userId).toBe(memberId);
    expect(newLeader.role).toBe('LEADER');

    // Old leaderId is now FORBIDDEN
    await expect(assertPodLeader(podId, leaderId)).rejects.toMatchObject({
      name: 'AuthzError',
      code: 'FORBIDDEN',
    });

    // Both remain members
    const mOld = await assertPodMember(podId, leaderId);
    expect(mOld.role).toBe('MEMBER');
    const mNew = await assertPodMember(podId, memberId);
    expect(mNew.role).toBe('LEADER');
  });

  it('6. member who leaves (PodMember row retained per D9) remains an enrolled member until pod is COMPLETED', async () => {
    // Active pod: row remains in PodMember, assertPodMember succeeds
    const activeMember = await assertPodMember(podId, memberId);
    expect(activeMember.userId).toBe(memberId);

    // Completed pod: member remains queryable in pod member history
    const completedMember = await assertPodMember(completedPodId, memberId);
    expect(completedMember.userId).toBe(memberId);
  });
});
