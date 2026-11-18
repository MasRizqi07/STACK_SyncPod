import type { PodMember, Prisma, PrismaClient } from '@prisma/client';
import { db } from './index.js';

export type AuthzErrorCode = 'POD_NOT_FOUND' | 'NOT_A_MEMBER' | 'FORBIDDEN';

export class AuthzError extends Error {
  readonly code: AuthzErrorCode;

  constructor(code: AuthzErrorCode, message: string) {
    super(message);
    this.name = 'AuthzError';
    this.code = code;
  }
}

type DbLike = Pick<PrismaClient, 'sprintPod'> | Pick<Prisma.TransactionClient, 'sprintPod'>;

export async function assertPodMember(
  userId: string,
  podId: string,
  client: DbLike = db,
): Promise<PodMember> {
  const pod = await client.sprintPod.findUnique({
    where: { id: podId },
    select: {
      id: true,
      members: {
        where: { userId },
        take: 1,
      },
    },
  });

  if (!pod) {
    throw new AuthzError('POD_NOT_FOUND', `Pod ${podId} not found`);
  }

  const membership = pod.members[0];
  if (!membership) {
    throw new AuthzError('NOT_A_MEMBER', `User ${userId} is not a member of pod ${podId}`);
  }

  return membership;
}

export async function assertPodLeader(
  userId: string,
  podId: string,
  client: DbLike = db,
): Promise<PodMember> {
  const membership = await assertPodMember(userId, podId, client);

  if (membership.role !== 'LEADER') {
    throw new AuthzError('FORBIDDEN', `User ${userId} is not the leader of pod ${podId}`);
  }

  return membership;
}
