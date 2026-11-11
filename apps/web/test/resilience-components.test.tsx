import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PodError from '../src/app/pod/[podId]/error';
import { MasukCard } from '../src/components/auth';
import {
  CockpitSkeleton,
  ConnectionBanner,
  EmptyState,
  SummarySkeleton,
  Toast,
} from '../src/components/common';
import { ModulePicker, RadioChipGroup } from '../src/components/matchmaking';
import { COPY } from '../src/copy';
import { MODULE_CATALOG, findModuleNodeById } from '../src/features/matchmaking';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Phase 2b UI components, resilience states, and real-mode guard (DESIGN A5, D18)', () => {
  it('renders ConnectionBanner only when offline or reconnecting', () => {
    const connectedHtml = renderToStaticMarkup(<ConnectionBanner connectionState="connected" />);
    expect(connectedHtml).toBe('');

    const reconnectingHtml = renderToStaticMarkup(
      <ConnectionBanner connectionState="reconnecting" />,
    );
    expect(reconnectingHtml).toContain(COPY.errors.disconnected);
    expect(reconnectingHtml).toContain('role="status"');
  });

  it('renders EmptyState with one directive sentence and one action, plus skeletons and Toast', () => {
    const emptyHtml = renderToStaticMarkup(
      <EmptyState
        title={COPY.cockpit.podNotFoundTitle}
        message={COPY.cockpit.podNotFoundBody}
        actionLabel={COPY.matchmaking.startMatching}
        href="/pod"
      />,
    );
    expect(emptyHtml).toContain(COPY.cockpit.podNotFoundTitle);
    expect(emptyHtml).toContain(COPY.cockpit.podNotFoundBody);
    expect(emptyHtml).toContain('href="/pod"');

    const cockpitSkel = renderToStaticMarkup(<CockpitSkeleton />);
    expect(cockpitSkel).toContain('aria-busy="true"');
    const summarySkel = renderToStaticMarkup(<SummarySkeleton />);
    expect(summarySkel).toContain('aria-busy="true"');

    expect(renderToStaticMarkup(<Toast message={null} />)).toBe('');
    const toastHtml = renderToStaticMarkup(<Toast message={COPY.summary.downloadedToast} />);
    expect(toastHtml).toContain(COPY.summary.downloadedToast);
  });

  it('renders pod segment error boundary with Muat ulang pod action', () => {
    const reset = vi.fn();
    const html = renderToStaticMarkup(<PodError reset={reset} />);
    expect(html).toContain(COPY.cockpit.errorBoundaryTitle);
    expect(html).toContain(COPY.cockpit.errorBoundaryRetry);
  });

  it('renders non-leaf hint in ModulePicker and radiogroup roles in RadioChipGroup', () => {
    const nonLeafNode = findModuleNodeById('topic-sd-graf');
    const pickerHtml = renderToStaticMarkup(
      <ModulePicker
        nodes={MODULE_CATALOG}
        selectedNode={nonLeafNode}
        onSelectNode={() => undefined}
      />,
    );
    expect(pickerHtml).toContain(COPY.matchmaking.moduleHintNonLeaf);
    expect(pickerHtml).toContain('Struktur Data');
    expect(pickerHtml).toContain('Aljabar Linier');
    expect(pickerHtml).toContain('Sistem Operasi');

    const chipHtml = renderToStaticMarkup(
      <RadioChipGroup
        options={[
          { value: 'QUIZ_PREP', label: COPY.matchmaking.urgencyOptions.QUIZ_PREP },
          { value: 'THEORY_REVIEW', label: COPY.matchmaking.urgencyOptions.THEORY_REVIEW },
        ]}
        value="QUIZ_PREP"
        onChange={() => undefined}
        labelledBy="urgency-label"
      />,
    );
    expect(chipHtml).toContain('role="radiogroup"');
    expect(chipHtml).toContain('role="radio"');
    expect(chipHtml).toContain('aria-checked="true"');
    expect(chipHtml).toContain('tabindex="0"');
    expect(chipHtml).toContain('tabindex="-1"');
  });

  it('hides demo login on MasukCard in real mode when DEMO_MODE is disabled (D18)', () => {
    const prevMode = process.env.NEXT_PUBLIC_REALTIME_MODE;
    process.env.NEXT_PUBLIC_REALTIME_MODE = 'real';
    try {
      const noDemoHtml = renderToStaticMarkup(<MasukCard demoModeEnabled={false} />);
      expect(noDemoHtml).toContain(COPY.auth.headline);
      expect(noDemoHtml).toContain(COPY.auth.signInGoogle);
      expect(noDemoHtml).not.toContain(COPY.auth.signInDemo);
      expect(noDemoHtml).not.toContain('href="/pod"');

      const withDemoHtml = renderToStaticMarkup(<MasukCard demoModeEnabled={true} />);
      expect(withDemoHtml).toContain(COPY.auth.signInDemo);
    } finally {
      if (prevMode === undefined) {
        delete process.env.NEXT_PUBLIC_REALTIME_MODE;
      } else {
        process.env.NEXT_PUBLIC_REALTIME_MODE = prevMode;
      }
    }
  });
});
