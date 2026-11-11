import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_A_MEMBER',
  'POD_NOT_FOUND',
  'VALIDATION_FAILED',
  'ALREADY_MATCHING',
  'ALREADY_IN_POD',
  'QUESTION_LIMIT',
  'RATE_LIMITED',
  'GEMINI_UNAVAILABLE',
  'GUARDRAIL_BLOCKED',
  'INVALID_STATE',
]);

export const urgencySchema = z.enum([
  'QUIZ_PREP',
  'STUCK_ASSIGNMENT',
  'THEORY_REVIEW',
]);

export const podPhaseSchema = z.enum([
  'LOBBY',
  'FOCUS',
  'BREAK',
  'COMPLETED',
]);

export const podRoleSchema = z.enum(['LEADER', 'MEMBER']);

export const presenceStatusSchema = z.enum([
  'IN_FOCUS',
  'TAKING_NOTES',
  'ASKING_GEMINI',
  'DISCONNECTED',
]);

export const clientPresenceStatusSchema = z.enum([
  'IN_FOCUS',
  'TAKING_NOTES',
]);

export const timerActionSchema = z.enum(['PAUSE', 'RESUME', 'SKIP', 'END']);

const entityIdSchema = z.string().trim().min(1).max(128);

export const socraticHintSchema = z.strictObject({
  concept: z.string().trim().min(1).max(400),
  guidingQuestions: z.tuple([
    z.string().trim().min(1).max(400),
    z.string().trim().min(1).max(400),
    z.string().trim().min(1).max(400),
  ]),
  analogy: z.string().trim().min(1).max(800),
  docHint: z
    .strictObject({
      source: z.string().trim().min(1).max(160),
      searchFor: z.string().trim().min(1).max(200),
    })
    .optional(),
});

export const questionDtoSchema = z.strictObject({
  id: entityIdSchema,
  podId: entityIdSchema,
  authorId: entityIdSchema,
  authorName: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(280),
  aiHint: socraticHintSchema.nullable(),
  resolved: z.boolean(),
  createdAt: z.int().nonnegative(),
});

export const podMemberDtoSchema = z.strictObject({
  userId: entityIdSchema,
  name: z.string().trim().min(1).max(120),
  universityName: z.string().trim().min(1).max(160).optional(),
  role: podRoleSchema,
  status: presenceStatusSchema,
  isSimulated: z.boolean().optional(),
  focusedSec: z.int().nonnegative().optional(),
});

export const podSnapshotSchema = z.strictObject({
  podId: entityIdSchema,
  module: z.strictObject({
    id: entityIdSchema,
    title: z.string().trim().min(1).max(200),
    path: z.array(z.string().trim().min(1).max(200)).min(1),
  }),
  phase: podPhaseSchema,
  round: z.int().nonnegative(),
  phaseEndsAt: z.int().nonnegative().nullable(),
  pausedRemainingMs: z.int().nonnegative().nullable(),
  phaseDurationSec: z.int().positive(),
  serverNow: z.int().nonnegative(),
  leaderId: entityIdSchema,
  members: z.array(podMemberDtoSchema),
  questions: z.array(questionDtoSchema),
});

// Client -> Server payloads (strict: never carry acting userId)
export const timePingPayloadSchema = z.strictObject({
  t0: z.number().nonnegative(),
});

export const matchEnqueuePayloadSchema = z.strictObject({
  moduleId: entityIdSchema,
  urgency: urgencySchema,
  windowStart: z.int().positive(),
  windowEnd: z.int().positive(),
});

export const matchCancelPayloadSchema = z.strictObject({});

export const matchFallbackReplyPayloadSchema = z.union([
  z.strictObject({
    offerId: entityIdSchema,
    accept: z.boolean(),
  }),
  z.strictObject({
    offerId: entityIdSchema,
    extend: z.literal(true),
  }),
]);

export const podJoinPayloadSchema = z.strictObject({
  podId: entityIdSchema,
});

export const podLeavePayloadSchema = z.strictObject({
  podId: entityIdSchema,
});

export const podStartPayloadSchema = z.strictObject({
  podId: entityIdSchema,
});

export const timerControlPayloadSchema = z.strictObject({
  podId: entityIdSchema,
  action: timerActionSchema,
});

export const presenceSetPayloadSchema = z.strictObject({
  podId: entityIdSchema,
  status: clientPresenceStatusSchema,
});

export const queueAddPayloadSchema = z.strictObject({
  podId: entityIdSchema,
  text: z.string().trim().min(1).max(280),
});

export const queueResolvePayloadSchema = z.strictObject({
  podId: entityIdSchema,
  questionId: entityIdSchema,
});

export const socraticAskPayloadSchema = z.strictObject({
  podId: entityIdSchema,
  questionId: entityIdSchema,
});

export const endorseGivePayloadSchema = z.strictObject({
  podId: entityIdSchema,
  toUserId: entityIdSchema,
});

// Server -> Client payloads
export const matchUpdateEventSchema = z.strictObject({
  waitingCount: z.int().nonnegative(),
  seats: z.int().min(1).max(4),
});

export const matchFoundEventSchema = z.strictObject({
  podId: entityIdSchema,
});

export const matchFallbackOfferEventSchema = z.strictObject({
  offerId: entityIdSchema,
  count: z.literal(3),
  expiresAt: z.int().positive(),
});

export const presenceUpdateEventSchema = z.strictObject({
  userId: entityIdSchema,
  status: presenceStatusSchema,
});

export const queueUpdateEventSchema = z.strictObject({
  questions: z.array(questionDtoSchema),
});

export const socraticResultEventSchema = z.strictObject({
  questionId: entityIdSchema,
  hint: socraticHintSchema,
});

export const socraticErrorEventSchema = z.strictObject({
  questionId: entityIdSchema,
  code: errorCodeSchema,
  retryAfterMs: z.int().nonnegative().optional(),
});
