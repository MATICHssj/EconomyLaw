import { Link } from 'react-router';
import { CheckCircle2, Circle } from 'lucide-react';
import { useData } from '@/stores/data';
import { useUI } from '@/stores/ui';
import { Card, CardTitle, PageHeader, ProgressBar, Segmented, cx } from '@/components/ui';
import { useState } from 'react';
import { LESSONS, completedLessons } from './lessons';
import { useMissions } from './missions';

export default function AcademyPage() {
  const [track, setTrack] = useState<'all' | 'app' | 'money'>('all');
  const done = completedLessons();
  const { missions, done: missionsDone, progress } = useMissions();
  const openCapture = useUI((s) => s.openCapture);
  const level = useData((s) => s.profile?.level ?? 'basic');
  const lessons = LESSONS.filter((l) => track === 'all' || l.track === track);
  const lessonPct = Math.round((LESSONS.filter((l) => done.has(l.id)).length / LESSONS.length) * 100);

  return (
    <div className="space-y-4">
      <PageHeader title="Aprende" subtitle="Lecciones de 2 minutos para que tu dinero rinda más." />
      <Card>
        <CardTitle>🗺️ Tus misiones · nivel {level === 'basic' ? 'Básico' : level === 'organized' ? 'Organizado' : 'Experto'}</CardTitle>
        <ProgressBar value={progress * 100} label="Progreso de misiones" />
        <ul className="mt-3 space-y-1">
          {missions.map((m) => {
            const ok = missionsDone.has(m.id);
            const content = (
              <>
                {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="h-5 w-5 shrink-0 text-line" />}
                <span className="text-lg">{m.emoji}</span>
                <span className={cx('flex-1 text-sm', ok ? 'text-muted line-through' : 'font-medium text-ink')}>{m.title}</span>
              </>
            );
            return (
              <li key={m.id}>
                {m.to.includes('capture') ? (
                  <button type="button" className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left hover:bg-surface-2" onClick={() => openCapture()}>
                    {content}
                  </button>
                ) : (
                  <Link to={m.to} className="flex items-center gap-2 rounded-xl px-1 py-1.5 hover:bg-surface-2">
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <div className="flex items-center justify-between">
        <Segmented value={track} onChange={setTrack} options={[{ value: 'all', label: 'Todo' }, { value: 'app', label: 'Usar la app' }, { value: 'money', label: 'Finanzas' }]} />
      </div>
      <p className="text-sm text-muted">{lessonPct} % de lecciones completadas</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {lessons.map((l) => (
          <Link key={l.id} to={`/aprende/${l.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-accent-300">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-2xl">{l.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{l.title}</span>
              <span className="text-sm text-muted">
                {l.minutes} min · {l.track === 'app' ? 'Usar la app' : 'Finanzas'}
              </span>
            </span>
            {done.has(l.id) && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
