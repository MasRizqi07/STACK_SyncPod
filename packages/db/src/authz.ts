import type { PodMember, Prisma, PrismaClient } from '@prisma/client';
import type { ErrorCode } from '@syncpod/shared';
import { db } from './index.js';

export type AuthzErrorCode = Extract<ErrorCode, 'POD_NOT_FOUND' | 'NOT_A_MEMBER' | 'FORBIDDEN'>;

export class AuthzError extends Error {
  readonly code: AuthzErrorCode;

  constructor(code: AuthzErrorCode, message: string) {
    super(message);
    this.name = 'AuthzError';
    this.code = code;
  }
}

type DbLike = Pick<PrismaClient, 'sprintPod'> | Pick<Prisma.TransactionClient, 'sprintPod'>;

/**
 * Asserts that a user is an enrolled member of a sprint pod.
 * Supports both signatures (podId, userId) and (userId, podId) for backwards compatibility.
 * Dependency direction: packages/db imports @syncpod/shared, never vice versa.
 * userId must always originate from trusted server context (session or verified realtime token).
 */
export async function assertPodMember(
  first: string,
  second: string,
  client: DbLike = db,
): Promise<PodMember> {
  // 1. Attempt to treat `first` as podId and `second` as userId
  let pod = await client.sprintPod.findUnique({
    where: { id: first },
    select: {
      id: true,
      members: {
        where: { userId: second },
        take: 1,
      },
    },
  });

  if (pod) {
    const membership = pod.members[0];
    if (!membership) {
      throw new AuthzError('NOT_A_MEMBER', `User ${second} is not a member of pod ${first}`);
    }
    return membership;
  }

  // 2. Attempt to treat `second` as podId and `first` as userId
  pod = await client.sprintPod.findUnique({
    where: { id: second },
    select: {
      id: true,
      members: {
        where: { userId: first },
        take: 1,
      },
    },
  });

  if (pod) {
    const membership = pod.members[0];
    if (!membership) {
      throw new AuthzError('NOT_A_MEMBER', `User ${first} is not a member of pod ${second}`);
    }
    return membership;
  }

  // 3. Pod not found under either parameter
  throw new AuthzError('POD_NOT_FOUND', `Pod ${first} not found`);
}

/**
 * Asserts that a user is the active LEADER of a sprint pod.
 * Supports both signatures (podId, userId) and (userId, podId).
 */
export async function assertPodLeader(
  first: string,
  second: string,
  client: DbLike = db,
): Promise<PodMember> {
  const membership = await assertPodMember(first, second, client);

  if (membership.role !== 'LEADER') {
    throw new AuthzError(
      'FORBIDDEN',
      `User ${membership.userId} is not the leader of pod ${membership.podId}`,
    );
  }

  return membership;
}
