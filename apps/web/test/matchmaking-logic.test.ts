import { describe, expect, it } from 'vitest';
import { COPY } from '../src/copy';
import {
  MIN_WINDOW_MS,
  MODULE_CATALOG,
  NEXT_HOUR_WINDOW_MS,
  filterModuleCatalog,
  findModuleNodeById,
  getDefaultCustomWindowTimes,
  getLeafModules,
  jakartaTodayTimeToEpochMs,
  resolveMatchingWindow,
} from '../src/features/matchmaking';

describe('syllabus taxonomy and Asia/Jakarta window rules (PRD FR-1.3, FR-2.2, D6)', () => {
  it('provides at least 3 ITATS courses with strict 3-level non-leaf -> topic -> leaf hierarchy', () => {
    expect(MODULE_CATALOG.length).toBeGreaterThanOrEqual(3);

    for (const course of MODULE_CATALOG) {
      expect(course.isLeaf).toBe(false);
      expect(course.children?.length).toBeGreaterThan(0);

      for (const topic of course.children ?? []) {
        expect(topic.isLeaf).toBe(false);
        expect(topic.children?.length).toBeGreaterThan(0);

        for (const leaf of topic.children ?? []) {
          expect(leaf.isLeaf).toBe(true);
          expect(leaf.path).toHaveLength(3);
        }
      }
    }

    const leaves = getLeafModules();
    expect(leaves.length).toBeGreaterThanOrEqual(6);
    expect(findModuleNodeById('mod-dijkstra')?.isLeaf).toBe(true);
    expect(findModuleNodeById('course-if201')?.isLeaf).toBe(false);
  });

  it('filters module catalog across course codes and leaf titles', () => {
    const dijkstra = filterModuleCatalog('Dijkstra');
    expect(dijkstra).toHaveLength(1);
    expect(dijkstra[0]?.children?.[0]?.children?.map((m) => m.id)).toContain('mod-dijkstra');

    const empty = filterModuleCatalog('MataKuliahYangTidakAda123');
    expect(empty).toEqual([]);
  });

  it('resolves NOW_25M and NEXT_HOUR presets exactly from reference nowMs', () => {
    // 2026-11-11 14:00:00 Asia/Jakarta (UTC 07:00:00)
    const nowMs = Date.UTC(2026, 10, 11, 7, 0, 0);

    const now25 = resolveMatchingWindow('NOW_25M', { startHHMM: '', endHHMM: '' }, nowMs);
    expect(now25).toEqual({
      ok: true,
      windowStart: nowMs,
      windowEnd: nowMs + MIN_WINDOW_MS,
    });

    const nextHour = resolveMatchingWindow('NEXT_HOUR', { startHHMM: '', endHHMM: '' }, nowMs);
    expect(nextHour).toEqual({
      ok: true,
      windowStart: nowMs,
      windowEnd: nowMs + NEXT_HOUR_WINDOW_MS,
    });
  });

  it('validates custom Asia/Jakarta windows: clamps start < now, accepts up to 23:59, rejects < 25m and past windows', () => {
    // 2026-11-11 20:15:00 Asia/Jakarta (UTC 13:15:00)
    const nowMs = Date.UTC(2026, 10, 11, 13, 15, 0);

    // Start in the past (20:00), end at 20:50 -> clamped to [20:15, 20:50] (35m >= 25m)
    const clampedValid = resolveMatchingWindow(
      'CUSTOM',
      { startHHMM: '20:00', endHHMM: '20:50' },
      nowMs,
    );
    expect(clampedValid).toEqual({
      ok: true,
      windowStart: nowMs,
      windowEnd: jakartaTodayTimeToEpochMs('20:50', nowMs),
    });

    // Window < 25m rejected with PRD error copy
    const tooShort = resolveMatchingWindow(
      'CUSTOM',
      { startHHMM: '20:15', endHHMM: '20:39' },
      nowMs,
    );
    expect(tooShort).toEqual({ ok: false, message: COPY.errors.windowTooShort });

    // Clamped window leaves < 25m remaining rejected even if raw span is 35m
    const clampedTooShort = resolveMatchingWindow(
      'CUSTOM',
      { startHHMM: '20:00', endHHMM: '20:35' },
      nowMs,
    );
    expect(clampedTooShort).toEqual({ ok: false, message: COPY.errors.windowTooShort });

    // Window ending before or equal to now rejected
    const pastWindow = resolveMatchingWindow(
      'CUSTOM',
      { startHHMM: '19:00', endHHMM: '20:10' },
      nowMs,
    );
    expect(pastWindow).toEqual({ ok: false, message: COPY.errors.windowPast });

    // Window ending at 23:59 today accepted
    const lateTonight = resolveMatchingWindow(
      'CUSTOM',
      { startHHMM: '23:10', endHHMM: '23:59' },
      nowMs,
    );
    expect(lateTonight.ok).toBe(true);

    // Default helper produces >= 25m clamped to 23:59
    const defaults = getDefaultCustomWindowTimes(nowMs);
    expect(defaults).toEqual({ startHHMM: '20:15', endHHMM: '21:00' });
  });
});
