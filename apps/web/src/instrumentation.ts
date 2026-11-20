import { getEnv } from './env';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }
  // Skip strict runtime secret checks during static build compilation
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }
  getEnv();
}
