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

export function MemberRow({ member, isCurrentUser = false, compact: _compact = true }: MemberRowProps) {
  const meta = getPresenceMeta(member.status);
  const Icon = meta.icon;
  const displayName = `${member.name}${isCurrentUser ? ' (Kamu)' : ''}`;

  return (
    <li
      data-member-id={member.userId}
      data-presence-status={member.status}
      title={displayName}
      className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-border-subtle bg-canvas/50 px-2.5 py-1.5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <span
              className="block truncate text-xs font-semibold text-ink-primary leading-tight"
              title={displayName}
            >
              {displayName}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-ink-muted leading-tight">
            {member.universityName && <span>{member.universityName}</span>}
            {member.role === 'LEADER' && (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded bg-surface-elevated px-1 py-0.5 text-[0.625rem] font-medium text-primary"
                title={COPY.cockpit.roleLeader}
              >
                <Crown className="h-2.5 w-2.5" aria-hidden="true" />
                <span>{COPY.cockpit.roleLeader}</span>
              </span>
            )}
            {member.isSimulated && (
              <span
                className="shrink-0 rounded bg-surface-elevated px-1 py-0.5 text-[0.625rem] font-medium text-ink-secondary"
                title={COPY.demo.simulatedBadge}
              >
                {COPY.demo.simulatedBadge}
              </span>
            )}
          </div>
        </div>
      </div>

      <span
        className={`inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-medium ${meta.badgeClass}`}
      >
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{meta.label}</span>
      </span>
    </li>
  );
}

