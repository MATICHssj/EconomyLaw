import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useUI } from '@/stores/ui';
import { Button, Card, EmptyState, PageHeader, cx } from '@/components/ui';
import { LESSONS, completeLesson } from './lessons';

/** Convierte **negritas** en <strong>. */
function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : part));
}

export default function LessonPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const openCapture = useUI((s) => s.openCapture);
  const lesson = LESSONS.find((l) => l.id === id);
  const [choice, setChoice] = useState<number | null>(null);
  if (!lesson) return <EmptyState emoji="🤷" title="Lección no encontrada" />;
  const idx = LESSONS.indexOf(lesson);
  const next = LESSONS[idx + 1];

  function finish() {
    completeLesson(lesson!.id);
    if (next) nav(`/aprende/${next.id}`);
    else nav('/aprende');
  }

  return (
    <article className="space-y-4">
      <PageHeader title={`${lesson.emoji} ${lesson.title}`} subtitle={`${lesson.minutes} minutos`} back="/aprende" />
      <Card className="space-y-3 text-[1.02rem] leading-relaxed text-ink/90">
        {lesson.body.map((p, i) => (
          <p key={i}>{rich(p)}</p>
        ))}
      </Card>
      {lesson.quiz && (
        <Card>
          <p className="font-semibold text-ink">🧠 {lesson.quiz.q}</p>
          <div className="mt-3 space-y-2" role="radiogroup">
            {lesson.quiz.options.map((o, i) => {
              const picked = choice === i;
              const correct = i === lesson.quiz!.answer;
              return (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  disabled={choice !== null}
                  onClick={() => setChoice(i)}
                  className={cx(
                    'w-full rounded-xl border-2 px-3 py-2.5 text-left transition',
                    choice === null ? 'border-line hover:border-accent-300' : correct ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : picked ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40' : 'border-line opacity-60',
                  )}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {choice !== null && <p className={cx('mt-3 text-sm', choice === lesson.quiz.answer ? 'text-income' : 'text-ink')}>{choice === lesson.quiz.answer ? '¡Correcto! 🎉 ' : 'Casi. '}{lesson.quiz.why}</p>}
        </Card>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        {lesson.tryIt &&
          (lesson.tryIt.to.includes('capture') ? (
            <Button variant="soft" block onClick={() => { completeLesson(lesson.id); openCapture(); }}>
              {lesson.tryIt.label}
            </Button>
          ) : (
            <Link to={lesson.tryIt.to} onClick={() => completeLesson(lesson.id)} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-accent-50 font-semibold text-accent-700 dark:bg-accent-950/60 dark:text-accent-200">
              {lesson.tryIt.label}
            </Link>
          ))}
        <Button block onClick={finish}>
          {next ? `Siguiente: ${next.emoji} ${next.title}` : 'Terminar'}
        </Button>
      </div>
    </article>
  );
}
