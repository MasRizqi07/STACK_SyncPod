import type { PodPhase } from '@syncpod/shared';
import { CheckCircle2, Pause } from 'lucide-react';
import { COPY } from '@/copy';
import { formatCountdown, isLastSixtySeconds } from '@/features/realtime';
import { MiniSeatDot, SeatDot, type PodSeatState, type SeatPosition } from './SeatDot';

export interface PodRingProps {
  mode: 'radar' | 'timer';
  seats: readonly PodSeatState[];
  progress: number;
  phase: PodPhase;
  round?: number;
  maxRounds?: number;
  remainingMs?: number;
  isPaused?: boolean;
  radarActive?: boolean;
  radarLabel?: string;
  variant?: 'full' | 'compact' | 'mini';
  announcePhase?: boolean;
  isMatched?: boolean;
}

const SEAT_POSITIONS: readonly [SeatPosition, SeatPosition, SeatPosition, SeatPosition] = [
  'top',
  'right',
  'bottom',
  'left',
];
const SVG_SIZE = 240;
const RING_CENTER = 120;
const RING_RADIUS = 92;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function clampProgress(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function getPhaseLabel(phase: PodPhase, round: number, isPaused: boolean): string {
  if (isPaused) {
    return COPY.cockpit.timer.pausedTag;
  }
  switch (phase) {
    case 'FOCUS':
      return COPY.cockpit.timer.focusPhase(round);
    case 'BREAK':
      return COPY.cockpit.timer.breakPhase;
    case 'COMPLETED':
      return COPY.cockpit.timer.completedPhase;
    case 'LOBBY':
      return COPY.cockpit.timer.lobbyPhase;
  }
}

function getPhaseAnnouncement(phase: PodPhase, round: number, isPaused: boolean): string {
  if (isPaused) {
    return COPY.cockpit.timer.phaseAnnouncement.paused;
  }
  switch (phase) {
    case 'FOCUS':
      return COPY.cockpit.timer.phaseAnnouncement.focusStarted(round);
    case 'BREAK':
      return COPY.cockpit.timer.phaseAnnouncement.breakStarted;
    case 'COMPLETED':
      return COPY.cockpit.timer.phaseAnnouncement.completed;
    case 'LOBBY':
      return COPY.cockpit.timer.lobbyPhase;
  }
}

function getArcColorVar(phase: PodPhase, isPaused: boolean): string {
  if (isPaused) {
    return 'var(--text-muted)';
  }
  switch (phase) {
    case 'FOCUS':
      return 'var(--color-primary)';
    case 'BREAK':
      return 'var(--color-amber)';
    case 'COMPLETED':
      return 'var(--color-emerald)';
    case 'LOBBY':
      return 'var(--text-muted)';
  }
}

function normalizeSeats(seats: readonly PodSeatState[]): PodSeatState[] {
  return [1, 2, 3, 4].map((num) => {
    const found = seats.find((seat) => seat.seatNumber === num);
    return found ?? { seatNumber: num as 1 | 2 | 3 | 4 };
  });
}

export function PodRing({
  mode,
  seats,
  progress,
  phase,
  round = 1,
  maxRounds = 4,
  remainingMs = 0,
  isPaused = false,
  radarActive = true,
  radarLabel,
  variant = 'full',
  announcePhase = true,
  isMatched = false,
}: PodRingProps) {
  const orderedSeats = normalizeSeats(seats);
  const occupiedCount = orderedSeats.filter((s) => s.member !== undefined).length;
  const clamped = clampProgress(progress);
  const dashOffset = RING_CIRCUMFERENCE * (1 - clamped);
  const lastMinute = mode === 'timer' && isLastSixtySeconds(phase, remainingMs, isPaused);
  const countdownText = formatCountdown(remainingMs);
  const phaseLabel = getPhaseLabel(phase, round, isPaused);
  const phaseAnnouncement = mode === 'timer' ? getPhaseAnnouncement(phase, round, isPaused) : '';

  if (variant === 'mini' && mode === 'timer') {
    const miniDashOffset = (2 * Math.PI * 10) * (1 - clamped);
    return (
      <div
        data-pod-ring-variant="mini"
        data-phase={phase}
        data-paused={isPaused ? 'true' : 'false'}
        data-last-minute={lastMinute ? 'true' : 'false'}
        className="flex w-full items-center justify-between gap-2 bg-surface px-3 py-2"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <svg
            viewBox="0 0 24 24"
            className={`h-6 w-6 shrink-0 ${lastMinute ? 'syncpod-arc-pulse' : ''}`}
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="2.5"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke={getArcColorVar(phase, isPaused)}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 10}
              strokeDashoffset={miniDashOffset}
              transform="rotate(-90 12 12)"
            />
          </svg>
          <span className="tabular-nums text-lg font-bold text-ink-primary">{countdownText}</span>
          <span
            className={`truncate text-xs font-medium ${
              phase === 'BREAK' && !isPaused ? 'text-amber' : 'text-ink-secondary'
            }`}
          >
            {phaseLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1" aria-label={COPY.cockpit.membersHeading}>
          {orderedSeats.map((seat) => (
            <MiniSeatDot key={seat.seatNumber} seatNumber={seat.seatNumber} member={seat.member} />
          ))}
        </div>
      </div>
    );
  }

  const sizeClass =
    variant === 'compact'
      ? 'h-[156px] w-[156px]'
      : mode === 'radar'
        ? 'w-full max-w-[340px] min-w-[300px] aspect-square'
        : 'h-[184px] w-[184px] xl:h-[180px] xl:w-[180px]';
  const strokeWidth = variant === 'compact' ? 7 : 6;
  const arcColor = getArcColorVar(phase, isPaused);

  return (
    <div
      data-pod-ring-mode={mode}
      data-pod-ring-variant={variant}
      data-phase={phase}
      data-paused={isPaused ? 'true' : 'false'}
      data-last-minute={lastMinute ? 'true' : 'false'}
      data-occupied-seats={occupiedCount}
      data-matched={isMatched ? 'true' : 'false'}
      className="flex w-full flex-col items-center"
    >
      {mode === 'timer' && announcePhase && (
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {phaseAnnouncement}
        </div>
      )}

      <div className={`relative ${sizeClass} select-none`}>
        <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="h-full w-full" aria-hidden="true">
          {mode === 'radar' && (
            <>
              <circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS - 20}
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="1"
                strokeDasharray="3 5"
              />
              {radarActive && !isMatched && (
                <g className="syncpod-radar-sweep" data-radar-sweep="active">
                  <path
                    d={`M ${RING_CENTER} ${RING_CENTER} L ${RING_CENTER} ${RING_CENTER - RING_RADIUS} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${
                      RING_CENTER + RING_RADIUS * Math.sin((55 * Math.PI) / 180)
                    } ${RING_CENTER - RING_RADIUS * Math.cos((55 * Math.PI) / 180)} Z`}
                    fill="var(--color-primary)"
                    fillOpacity="0.14"
                  />
                  <line
                    x1={RING_CENTER}
                    y1={RING_CENTER}
                    x2={RING_CENTER}
                    y2={RING_CENTER - RING_RADIUS}
                    stroke="var(--color-primary)"
                    strokeOpacity="0.7"
                    strokeWidth="2"
                  />
                </g>
              )}
            </>
          )}

          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth={strokeWidth}
            strokeOpacity={mode === 'radar' && !radarActive ? 0.45 : 1}
          />

          {mode === 'radar' && (
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-emerald)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={isMatched ? 0 : RING_CIRCUMFERENCE}
              transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
              className="syncpod-matched-track"
              style={{ opacity: isMatched ? 1 : 0 }}
              data-matched-circle="true"
            />
          )}

          {mode === 'timer' && (
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke={arcColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
              className={`transition-[stroke-dashoffset,stroke] duration-200 ${
                lastMinute ? 'syncpod-arc-pulse' : ''
              }`}
              data-timer-arc="true"
            />
          )}
        </svg>

        <ul className="m-0 list-none p-0" aria-label={COPY.cockpit.membersHeading}>
          {orderedSeats.map((seat, idx) => (
            <SeatDot
              key={seat.seatNumber}
              position={SEAT_POSITIONS[idx] ?? 'top'}
              seatNumber={seat.seatNumber}
              member={seat.member}
              mode={mode}
              compact={variant === 'compact'}
            />
          ))}
        </ul>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          {mode === 'radar' ? (
            isMatched ? (
              <div
                className="flex flex-col items-center justify-center gap-1.5"
                data-matched-feedback="true"
              >
                <CheckCircle2
                  className="h-10 w-10 text-emerald sm:h-12 sm:w-12"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <span className="font-display text-sm font-bold text-emerald sm:text-base">
                  {COPY.matchmaking.matchedTitle}
                </span>
              </div>
            ) : (
              <>
                <span className="tabular-nums text-3xl font-bold text-ink-primary sm:text-4xl">
                  {occupiedCount}/4
                </span>
                <span className="mt-1 max-w-[124px] text-xs font-medium leading-tight text-ink-secondary sm:text-sm">
                  {COPY.matchmaking.seatsCount(occupiedCount)}
                </span>
              </>
            )
          ) : (
            <>
              <span
                className={`tabular-nums font-bold text-ink-primary ${
                  variant === 'compact'
                    ? 'text-[1.75rem]'
                    : 'text-[clamp(2.25rem,3.6vw,3rem)] leading-none'
                }`}
              >
                {countdownText}
              </span>
              <span
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  isPaused
                    ? 'bg-surface-elevated text-ink-secondary'
                    : phase === 'BREAK'
                      ? 'bg-surface-elevated text-amber'
                      : phase === 'COMPLETED'
                        ? 'bg-surface-elevated text-emerald'
                        : 'text-ink-secondary'
                }`}
              >
                {isPaused && <Pause className="h-3 w-3 text-ink-secondary" aria-hidden="true" />}
                <span>{phaseLabel}</span>
              </span>
              {variant === 'full' && (phase === 'FOCUS' || phase === 'BREAK') && (
                <span className="mt-1 tabular-nums text-[0.75rem] text-ink-muted">
                  {COPY.cockpit.timer.roundProgress(round, maxRounds)}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {mode === 'radar' && (isMatched ? COPY.matchmaking.matchedSubtitle : radarLabel) && (
        <p
          className={`mt-3 max-w-[260px] text-center text-sm font-medium ${
            isMatched ? 'text-emerald' : 'text-ink-secondary'
          }`}
        >
          {isMatched ? COPY.matchmaking.matchedSubtitle : radarLabel}
        </p>
      )}
    </div>
  );
}
