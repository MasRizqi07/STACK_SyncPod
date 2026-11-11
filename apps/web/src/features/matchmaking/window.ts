import { COPY } from '@/copy';

export type WindowPreset = 'NOW_25M' | 'NEXT_HOUR' | 'CUSTOM';

export const JAKARTA_TIMEZONE = 'Asia/Jakarta';
export const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
export const MIN_WINDOW_MINUTES = 25;
export const MIN_WINDOW_MS = MIN_WINDOW_MINUTES * 60 * 1000;
export const NEXT_HOUR_WINDOW_MS = 60 * 60 * 1000;

export interface JakartaDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface CustomWindowInput {
  startHHMM: string;
  endHHMM: string;
}

export type WindowResolutionResult =
  | { ok: true; windowStart: number; windowEnd: number }
  | { ok: false; message: string };

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function getJakartaDateParts(epochMs: number): JakartaDateParts {
  // Asia/Jakarta (WIB) has fixed UTC+07:00 without daylight saving shifts.
  const shifted = new Date(epochMs + JAKARTA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function formatJakartaHHMM(epochMs: number): string {
  const parts = getJakartaDateParts(epochMs);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function jakartaTodayTimeToEpochMs(
  timeHHMM: string,
  referenceNowMs: number,
): number | null {
  const match = HHMM_REGEX.exec(timeHHMM.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const today = getJakartaDateParts(referenceNowMs);
  return Date.UTC(today.year, today.month - 1, today.day, hour, minute, 0, 0) - JAKARTA_OFFSET_MS;
}

export function getDefaultCustomWindowTimes(referenceNowMs: number): CustomWindowInput {
  const todayMaxEndMs =
    jakartaTodayTimeToEpochMs('23:59', referenceNowMs) ?? referenceNowMs + NEXT_HOUR_WINDOW_MS;
  const startMs = referenceNowMs;
  const desiredEndMs = Math.min(startMs + 45 * 60 * 1000, todayMaxEndMs);
  return {
    startHHMM: formatJakartaHHMM(startMs),
    endHHMM: formatJakartaHHMM(desiredEndMs),
  };
}

export function resolveMatchingWindow(
  preset: WindowPreset,
  custom: CustomWindowInput,
  nowMs: number,
): WindowResolutionResult {
  if (preset === 'NOW_25M') {
    return {
      ok: true,
      windowStart: nowMs,
      windowEnd: nowMs + MIN_WINDOW_MS,
    };
  }

  if (preset === 'NEXT_HOUR') {
    return {
      ok: true,
      windowStart: nowMs,
      windowEnd: nowMs + NEXT_HOUR_WINDOW_MS,
    };
  }

  const rawStart = jakartaTodayTimeToEpochMs(custom.startHHMM, nowMs);
  const rawEnd = jakartaTodayTimeToEpochMs(custom.endHHMM, nowMs);
  const endOfToday2359 = jakartaTodayTimeToEpochMs('23:59', nowMs);

  if (rawStart === null || rawEnd === null || endOfToday2359 === null) {
    return { ok: false, message: COPY.errors.windowTooShort };
  }

  if (rawEnd > endOfToday2359) {
    return { ok: false, message: COPY.errors.windowAfterMidnight };
  }

  if (rawEnd <= nowMs) {
    return { ok: false, message: COPY.errors.windowPast };
  }

  // D6: if windowStart < now, clamp it to now.
  const effectiveStart = Math.max(rawStart, nowMs);
  if (rawEnd - effectiveStart < MIN_WINDOW_MS) {
    return { ok: false, message: COPY.errors.windowTooShort };
  }

  return {
    ok: true,
    windowStart: effectiveStart,
    windowEnd: rawEnd,
  };
}
