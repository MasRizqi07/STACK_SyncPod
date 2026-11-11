import { describe, expect, it } from 'vitest';
import { podPhaseSchema } from '@syncpod/shared';
import { COPY } from '../src/copy.js';

describe('web copy and shared integration', () => {
  it('provides Indonesian UI strings matching DESIGN A7', () => {
    expect(COPY.brand.name).toBe('SyncPod');
    expect(COPY.matchmaking.startMatching).toBe('Cari pod');
    expect(COPY.cockpit.guidePrivacy).toBe(
      'Catatan pod dikirim ke Gemini saat kamu bertanya.',
    );
    expect(COPY.demo.simulatedBadge).toBe('Simulasi');
  });

  it('parses shared pod phases cleanly', () => {
    expect(podPhaseSchema.parse('FOCUS')).toBe('FOCUS');
  });
});

