import type { PodMemberDTO, PresenceStatus } from '@syncpod/shared';
import { PenLine, Sparkles, Target, UserCheck, WifiOff } from 'lucide-react';
import { COPY } from '@/copy';

export type SeatPosition = 'top' | 'right' | 'bottom' | 'left';

export interface PodSeatState {
  seatNumber: 1 | 2 | 3 | 4;
  member?: PodMemberDTO;
}

export interface SeatDotProps {
  position: SeatPosition;
  seatNumber: 1 | 2 | 3 | 4;
  member?: PodMemberDTO;
  mode: 'radar' | 'timer';
  compact?: boolean;
}

export function getMemberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  const firstChar = first[0] ?? '';
  const lastChar = last[0] ?? '';
  return `${firstChar}${lastChar}`.toUpperCase() || '?';
}

const POSITION_COORDS: Record<SeatPosition, { left: string; top: string }> = {
  top: { left: '50%', top: '11.6667%' },
  right: { left: '88.3333%', top: '50%' },
  bottom: { left: '50%', top: '88.3333%' },
  left: { left: '11.6667%', top: '50%' },
};

function getStatusStyles(status: PresenceStatus, mode: 'radar' | 'timer') {
  if (mode === 'radar') {
    return {
      ringClass: 'border-primary bg-surface-elevated text-primary',
      icon: UserCheck,
      label: COPY.cockpit.presence.IN_FOCUS,
    };
  }

  switch (status) {
    case 'IN_FOCUS':
      return {
        ringClass: 'border-primary bg-surface-elevated text-primary',
        icon: Target,
        label: COPY.cockpit.presence.IN_FOCUS,
      };
    case 'TAKING_NOTES':
      return {
        ringClass: 'border-emerald bg-surface-elevated text-emerald',
        icon: PenLine,
        label: COPY.cockpit.presence.TAKING_NOTES,
      };
    case 'ASKING_GEMINI':
      return {
        ringClass: 'border-purple bg-surface-elevated text-purple-text',
        icon: Sparkles,
        label: COPY.cockpit.presence.ASKING_GEMINI,
      };
    case 'DISCONNECTED':
      return {
        ringClass: 'border-ink-muted bg-canvas text-ink-muted border-dashed',
        icon: WifiOff,
        label: COPY.cockpit.presence.DISCONNECTED,
      };
  }
}

export function SeatDot({
  position,
  seatNumber,
  member,
  mode,
  compact = false,
}: SeatDotProps) {
  const coords = POSITION_COORDS[position];
  const sizeClass = compact ? 'h-6 w-6' : 'h-8 w-8 sm:h-9 sm:w-9';

  if (!member) {
    return (
      <li
        style={{ left: coords.left, top: coords.top }}
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 list-none"
      >
        <span
          className={`flex ${sizeClass} items-center justify-center rounded-full border-2 border-dashed border-ink-muted/60 bg-canvas`}
          title={COPY.cockpit.seatEmpty(seatNumber)}
        >
          <span className="sr-only">{COPY.cockpit.seatEmpty(seatNumber)}</span>
        </span>
      </li>
    );
  }

  const meta = getStatusStyles(member.status, mode);
  const StatusIcon = meta.icon;
  const initials = getMemberInitials(member.name);
  const occupiedLabel = member.isSimulated
    ? `${COPY.cockpit.seatOccupied(seatNumber, member.name, meta.label)} (${COPY.demo.simulatedBadge})`
    : COPY.cockpit.seatOccupied(seatNumber, member.name, meta.label);

  return (
    <li
      style={{ left: coords.left, top: coords.top }}
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 list-none"
    >
      <span
        data-seat-occupied="true"
        data-seat-status={member.status}
        title={occupiedLabel}
        className={`syncpod-seat-enter relative flex ${sizeClass} items-center justify-center rounded-full border-2 ${meta.ringClass} transition-colors duration-200`}
      >
        <span
          className="text-xs font-bold uppercase tracking-tight leading-none sm:text-sm"
          aria-hidden="true"
        >
          {initials}
        </span>
        {mode === 'timer' && (
          <span
            className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border-subtle bg-surface"
            aria-hidden="true"
          >
            <StatusIcon className="h-2 w-2" strokeWidth={2.5} />
          </span>
        )}
        <span className="sr-only">{occupiedLabel}</span>
      </span>
    </li>
  );
}

export interface MiniSeatDotProps {
  seatNumber: 1 | 2 | 3 | 4;
  member?: PodMemberDTO;
}

export function MiniSeatDot({ seatNumber, member }: MiniSeatDotProps) {
  if (!member) {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-ink-muted/60 bg-canvas"
        title={COPY.cockpit.seatEmpty(seatNumber)}
      >
        <span className="sr-only">{COPY.cockpit.seatEmpty(seatNumber)}</span>
      </span>
    );
  }

  const meta = getStatusStyles(member.status, 'timer');
  const StatusIcon = meta.icon;
  const label = member.isSimulated
    ? `${COPY.cockpit.seatOccupied(seatNumber, member.name, meta.label)} (${COPY.demo.simulatedBadge})`
    : COPY.cockpit.seatOccupied(seatNumber, member.name, meta.label);

  return (
    <span
      data-seat-status={member.status}
      title={label}
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${meta.ringClass}`}
    >
      <StatusIcon className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

