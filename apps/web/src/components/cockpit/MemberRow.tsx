import type { PodMemberDTO, PresenceStatus } from '@syncpod/shared';
import { Crown, PenLine, Sparkles, Target, WifiOff } from 'lucide-react';
import { COPY } from '@/copy';

export interface MemberRowProps {
  member: PodMemberDTO;
  isCurrentUser?: boolean;
  compact?: boolean;
}

function getPresenceMeta(status: PresenceStatus) {
  switch (status) {
    case 'IN_FOCUS':
      return {
        label: COPY.cockpit.presence.IN_FOCUS,
        icon: Target,
        dotClass: 'bg-primary',
        badgeClass: 'text-primary',
      };
    case 'TAKING_NOTES':
      return {
        label: COPY.cockpit.presence.TAKING_NOTES,
        icon: PenLine,
        dotClass: 'bg-emerald',
        badgeClass: 'text-emerald',
      };
    case 'ASKING_GEMINI':
      return {
        label: COPY.cockpit.presence.ASKING_GEMINI,
        icon: Sparkles,
        dotClass: 'bg-purple',
        badgeClass: 'text-purple-text',
      };
    case 'DISCONNECTED':
      return {
        label: COPY.cockpit.presence.DISCONNECTED,
        icon: WifiOff,
        dotClass: 'bg-ink-muted',
        badgeClass: 'text-ink-muted',
      };
  }
}

export function MemberRow({ member, isCurrentUser = false, compact = false }: MemberRowProps) {
  const meta = getPresenceMeta(member.status);
  const Icon = meta.icon;

  return (
    <li
      data-member-id={member.userId}
      data-presence-status={member.status}
      className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 rounded-[var(--radius-control)] border border-border-subtle bg-canvas/50 ${
        compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
      }`}
    >
      <div className="flex min-w-[120px] flex-1 items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-ink-primary">
              {member.name}
              {isCurrentUser ? ' (Kamu)' : ''}
            </span>
            {member.role === 'LEADER' && (
              <span
                className="inline-flex items-center gap-0.5 rounded bg-surface-elevated px-1.5 py-0.5 text-[0.75rem] font-medium text-primary"
                title={COPY.cockpit.roleLeader}
              >
                <Crown className="h-3 w-3" aria-hidden="true" />
                <span>{COPY.cockpit.roleLeader}</span>
              </span>
            )}
            {member.isSimulated && (
              <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[0.75rem] font-medium text-ink-secondary">
                {COPY.demo.simulatedBadge}
              </span>
            )}
          </div>
          {!compact && member.universityName && (
            <p className="truncate text-xs text-ink-muted">{member.universityName}</p>
          )}
        </div>
      </div>

      <span
        className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${meta.badgeClass}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{meta.label}</span>
      </span>
    </li>
  );
}

