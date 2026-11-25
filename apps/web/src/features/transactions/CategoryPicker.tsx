import { useState } from 'react';
import type { Category } from '@fina/core';
import { useData } from '@/stores/data';
import { cx } from '@/components/ui';

/** Cuadrícula de categorías con emoji (más rápido que una lista desplegable). */
export function CategoryPicker({
  value,
  onChange,
  type = 'expense',
}: {
  value: string | null;
  onChange: (id: string) => void;
  type?: Category['type'];
}) {
  const categories = useData((s) => s.data.categories);
  const [all, setAll] = useState(false);
  const list = categories
    .filter((c) => c.type === type && !c.archived && c.id !== 'adjustment')
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const shown = all ? list : list.slice(0, 15);
  return (
    <div>
      <div
        className="grid grid-cols-4 gap-2 sm:grid-cols-5"
        role="radiogroup"
        aria-label="Categoría"
      >
        {shown.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value === c.id}
            onClick={() => onChange(c.id)}
            className={cx(
              'flex flex-col items-center gap-1 rounded-xl border p-2 text-center text-[0.7rem] leading-tight font-medium transition',
              value === c.id
                ? 'border-accent-500 bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-100'
                : 'border-line text-ink hover:bg-surface-2',
            )}
          >
            <span className="text-2xl" aria-hidden>
              {c.emoji}
            </span>
            <span className="line-clamp-2">{c.name}</span>
          </button>
        ))}
      </div>
      {list.length > 15 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-2 text-sm font-semibold text-accent-600"
        >
          {all ? 'Ver menos' : `Ver todas (${list.length})`}
        </button>
      )}
    </div>
  );
}
