import { EmojiIcon } from '@/components/icons';
import { Link } from 'react-router';
import { CheckCircle2, Circle } from 'lucide-react';
import { useData } from '@/stores/data';
import { useUI } from '@/stores/ui';
import { Card, CardTitle, PageHeader, ProgressBar, Segmented, cx } from '@/components/ui';
import { useState } from 'react';
import { LESSONS, completedLessons } from './lessons';
import { PATHS, savePath, savedPath, type LearnPath } from './guides';
import { useMissions } from './missions';

export default function AcademyPage() {
  const [track, setTrack] = useState<'all' | 'app' | 'money'>('all');
  const done = completedLessons();
  const { missions, done: missionsDone, progress } = useMissions();
  const openCapture = useUI((s) => s.openCapture);
  const level = useData((s) => s.profile?.level ?? 'basic');
  const lessons = LESSONS.filter((l) => track === 'all' || l.track === track);
  const [path, setPath] = useState<LearnPath>(() => savedPath(level));
  const pathLessons = PATHS[path].lessons
    .map((id) => LESSONS.find((l) => l.id === id))
    .filter((l): l is (typeof LESSONS)[number] => !!l);
  const pathDone = pathLessons.filter((l) => done.has(l.id)).length;
  const nextInPath = pathLessons.find((l) => !done.has(l.id));
  const lessonPct = Math.round(
    (LESSONS.filter((l) => done.has(l.id)).length / LESSONS.length) * 100,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Aprende"
        subtitle="Aprende a usar Fina paso a paso y a que tu dinero rinda más."
      />
      <Card>
        <CardTitle>Aprende a usar Fina</CardTitle>
        <Segmented
          label="¿Cuánto sabes de finanzas?"
          value={path}
          onChange={(p) => {
            setPath(p);
            savePath(p);
          }}
          options={(Object.keys(PATHS) as LearnPath[]).map((p) => ({
            value: p,
            label: PATHS[p].label,
          }))}
        />
        <p className="mt-2 text-sm text-muted">{PATHS[path].tagline}</p>
        <ProgressBar
          className="mt-3"
          value={pathLessons.length ? (pathDone / pathLessons.length) * 100 : 0}
          label="Progreso de la ruta"
        />
        <p className="mt-1 text-xs text-muted">
          {pathDone} de {pathLessons.length} guías
        </p>
        <ol className="mt-3 space-y-1">
          {pathLessons.map((l, i) => {
            const ok = done.has(l.id);
            const isNext = nextInPath?.id === l.id;
            return (
              <li key={l.id}>
                <Link
                  to={`/aprende/${l.id}`}
                  className={cx(
                    'flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2',
                    isNext && 'bg-accent-50 dark:bg-accent-950/40',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      ok
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-surface-2 text-muted',
                    )}
                  >
                    {ok ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx('block truncate', ok ? 'text-muted' : 'font-medium text-ink')}
                    >
                      {l.title}
                    </span>
                    <span className="text-xs text-muted">
                      {l.minutes} min · {l.track === 'app' ? 'Usar la app' : 'Finanzas'}
                    </span>
                  </span>
                  {isNext && <span className="text-sm font-semibold text-accent-700">Empezar</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>
      <Card>
        <CardTitle>
          Tus misiones · nivel{' '}
          {level === 'basic' ? 'Básico' : level === 'organized' ? 'Organizado' : 'Experto'}
        </CardTitle>
        <ProgressBar value={progress * 100} label="Progreso de misiones" />
        <ul className="mt-3 space-y-1">
          {missions.map((m) => {
            const ok = missionsDone.has(m.id);
            const content = (
              <>
                {ok ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-line" />
                )}
                <EmojiIcon emoji={m.emoji} className="h-[1.1rem] w-[1.1rem] shrink-0 text-muted" />
                <span
                  className={cx(
                    'flex-1 text-sm',
                    ok ? 'text-muted line-through' : 'font-medium text-ink',
                  )}
                >
                  {m.title}
                </span>
              </>
            );
            return (
              <li key={m.id}>
                {m.to.includes('capture') ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left hover:bg-surface-2"
                    onClick={() => openCapture()}
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    to={m.to}
                    className="flex items-center gap-2 rounded-xl px-1 py-1.5 hover:bg-surface-2"
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <div className="flex items-center justify-between">
        <Segmented
          value={track}
          onChange={setTrack}
          options={[
            { value: 'all', label: 'Todo' },
            { value: 'app', label: 'Usar la app' },
            { value: 'money', label: 'Finanzas' },
          ]}
        />
      </div>
      <p className="text-sm text-muted">{lessonPct} % de lecciones completadas</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {lessons.map((l) => (
          <Link
            key={l.id}
            to={`/aprende/${l.id}`}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-accent-300"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-200">
              <EmojiIcon emoji={l.emoji} className="h-6 w-6" />
            </span>
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
