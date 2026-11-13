import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PodMemberDTO } from '@syncpod/shared';
import { PodRing, type PodSeatState } from '../src/components/pod-ring';

function makeMember(
  userId: string,
  name: string,
  status: PodMemberDTO['status'],
  isSimulated = false,
): PodMemberDTO {
  return {
    userId,
    name,
    role: 'MEMBER',
    status,
    isSimulated,
  };
}

describe('PodRing rendering across radar, timer, and presence states', () => {
  it('renders radar 1/4, 3/4, and 4/4 with empty dashed circles and occupied count', () => {
    const seatsOne: PodSeatState[] = [
      { seatNumber: 1, member: makeMember('u1', 'Rizqi', 'IN_FOCUS') },
    ];
    const htmlOne = renderToStaticMarkup(
      <PodRing mode="radar" seats={seatsOne} progress={0} phase="LOBBY" />,
    );
    expect(htmlOne).toContain('1/4');
    expect(htmlOne).toContain('Kursi 1/4 terisi');
    expect(htmlOne).toContain('Kursi 2 kosong');
    expect(htmlOne).toContain('border-dashed');
    expect(htmlOne).toContain('syncpod-radar-sweep');
    expect(htmlOne).toContain('syncpod-seat-enter');
    expect(htmlOne).toContain('min-w-[300px]');
    expect(htmlOne).toContain('RI');

    const seatsThree: PodSeatState[] = [
      { seatNumber: 1, member: makeMember('u1', 'Rizqi', 'IN_FOCUS') },
      { seatNumber: 2, member: makeMember('s1', 'Rifqi', 'IN_FOCUS', true) },
      { seatNumber: 3, member: makeMember('s2', 'Farhan', 'IN_FOCUS', true) },
    ];
    const htmlThree = renderToStaticMarkup(
      <PodRing
        mode="radar"
        seats={seatsThree}
        progress={0}
        phase="LOBBY"
        radarLabel="Menemukan 3 dari 4 teman belajar"
      />,
    );
    expect(htmlThree).toContain('3/4');
    expect(htmlThree).toContain('Kursi 3/4 terisi');
    expect(htmlThree).toContain('Menemukan 3 dari 4 teman belajar');
    expect(htmlThree).toContain('Kursi 4 kosong');

    const seatsFour: PodSeatState[] = [
      { seatNumber: 1, member: makeMember('u1', 'Rizqi', 'IN_FOCUS') },
      { seatNumber: 2, member: makeMember('s1', 'Rifqi', 'IN_FOCUS', true) },
      { seatNumber: 3, member: makeMember('s2', 'Farhan', 'IN_FOCUS', true) },
      { seatNumber: 4, member: makeMember('s3', 'Rivan', 'IN_FOCUS', true) },
    ];
    const htmlFour = renderToStaticMarkup(
      <PodRing mode="radar" seats={seatsFour} progress={0} phase="LOBBY" />,
    );
    expect(htmlFour).toContain('4/4');
    expect(htmlFour).toContain('Simulasi');
    expect(htmlFour).not.toContain('kosong');

    const htmlMatched = renderToStaticMarkup(
      <PodRing
        mode="radar"
        seats={seatsFour}
        progress={0}
        phase="LOBBY"
        isMatched={true}
      />,
    );
    expect(htmlMatched).toContain('data-matched="true"');
    expect(htmlMatched).toContain('data-matched-circle="true"');
    expect(htmlMatched).toContain('data-matched-feedback="true"');
    expect(htmlMatched).toContain('Pod lengkap!');
    expect(htmlMatched).toContain('Memulai sprint belajar...');
    expect(htmlMatched).not.toContain('data-radar-sweep="active"');
  });

  it('renders timer FOCUS, BREAK, paused, and last 60s pulse with polite phase announcement', () => {
    const seats: PodSeatState[] = [
      { seatNumber: 1, member: makeMember('u1', 'Rizqi', 'IN_FOCUS') },
      { seatNumber: 2, member: makeMember('s1', 'Rifqi', 'TAKING_NOTES', true) },
      { seatNumber: 3, member: makeMember('s2', 'Farhan', 'ASKING_GEMINI', true) },
      { seatNumber: 4, member: makeMember('s3', 'Rivan', 'DISCONNECTED', true) },
    ];

    const focusHtml = renderToStaticMarkup(
      <PodRing
        mode="timer"
        seats={seats}
        progress={0.25}
        phase="FOCUS"
        round={1}
        remainingMs={1_458_000}
      />,
    );
    expect(focusHtml).toContain('24:18');
    expect(focusHtml).toContain('Sprint fokus 1');
    expect(focusHtml).toContain('aria-live="polite"');
    expect(focusHtml).toContain('data-last-minute="false"');
    expect(focusHtml).not.toContain('syncpod-arc-pulse');
    expect(focusHtml).toContain('status Fokus');
    expect(focusHtml).toContain('status Mencatat');
    expect(focusHtml).toContain('status Bertanya ke pemandu');
    expect(focusHtml).toContain('status Terputus');

    const lastMinuteHtml = renderToStaticMarkup(
      <PodRing
        mode="timer"
        seats={seats}
        progress={0.75}
        phase="FOCUS"
        round={1}
        remainingMs={42_000}
      />,
    );
    expect(lastMinuteHtml).toContain('00:42');
    expect(lastMinuteHtml).toContain('data-last-minute="true"');
    expect(lastMinuteHtml).toContain('syncpod-arc-pulse');

    const pausedHtml = renderToStaticMarkup(
      <PodRing
        mode="timer"
        seats={seats}
        progress={0.4}
        phase="FOCUS"
        round={1}
        remainingMs={900_000}
        isPaused={true}
      />,
    );
    expect(pausedHtml).toContain('Dijeda');
    expect(pausedHtml).toContain('data-paused="true"');
    expect(pausedHtml).toContain('data-last-minute="false"');

    const breakHtml = renderToStaticMarkup(
      <PodRing
        mode="timer"
        seats={seats}
        progress={0.5}
        phase="BREAK"
        round={1}
        remainingMs={15_000}
      />,
    );
    expect(breakHtml).toContain('Istirahat');
    expect(breakHtml).toContain('var(--color-amber)');
  });
});

