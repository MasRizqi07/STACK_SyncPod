import { MatchmakingShell } from '@/components/matchmaking';
import { requireSession } from '@/lib/session';
import { signOut } from '@/auth';
import { COPY } from '@/copy';

export const dynamic = 'force-dynamic';

export default async function MatchmakingPage() {
  const isReal = process.env.NEXT_PUBLIC_REALTIME_MODE === 'real';

  if (isReal) {
    // D38 defense-in-depth: server component enforces valid session or redirects to /masuk
    const user = await requireSession('page');

    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-lg text-emerald-400">{COPY.brand.name}</span>
            <span className="text-xs text-slate-400 font-mono">Realtime Engine</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-200">{user.name}</p>
              {user.email && <p className="text-xs text-slate-500 font-mono">{user.email}</p>}
            </div>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/masuk' });
              }}
            >
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                {COPY.auth.signOut}
              </button>
            </form>
          </div>
        </header>

        <section className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 rounded-xl border border-slate-800 bg-slate-900/80 text-center space-y-4 shadow-xl">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-100">
              {COPY.auth.realtimeUnavailableTitle}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              {COPY.auth.realtimeUnavailableDesc}
            </p>
            <div className="pt-2">
              <span className="inline-block text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">
                Phase 4: Collaborative Workspace & Socket.IO
              </span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const demoModeEnabled = process.env.DEMO_MODE === 'true';
  return <MatchmakingShell demoModeEnabled={demoModeEnabled} />;
}
