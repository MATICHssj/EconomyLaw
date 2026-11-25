import { CatIcon, IconPicker } from '@/components/icons';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { DEFAULT_CATEGORY_MAP, newId, type Category } from '@fina/core';
import { saveDoc } from '@/lib/actions';
import { useData } from '@/stores/data';
import { Button, Card, Input, PageHeader, Segmented, Select, Sheet, Toggle } from '@/components/ui';

const DEFAULT_IDS = new Set(Object.keys(DEFAULT_CATEGORY_MAP));

const COLORS = [
  '#ea580c',
  '#d97706',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#475569',
  '#0d9488',
];

export default function CategoriesPage() {
  const categories = useData((s) => s.data.categories);
  const [type, setType] = useState<Category['type']>('expense');
  const [editing, setEditing] = useState<Category | null>(null);
  const list = categories
    .filter((c) => c.type === type && c.id !== 'adjustment')
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.order - b.order);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categorías"
        subtitle="Personalízalas con ícono y color. Las de sistema no se pueden borrar."
        back
        actions={
          <Button
            size="sm"
            onClick={() =>
              setEditing({
                id: newId(),
                name: '',
                emoji: 'i:tag',
                color: COLORS[0]!,
                parentId: null,
                type,
                group: type === 'income' ? 'income' : 'wants',
                archived: false,
                system: false,
                order: 100,
              })
            }
          >
            <Plus className="h-4 w-4" /> Nueva
          </Button>
        }
      />
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: 'expense', label: 'Gastos' },
          { value: 'income', label: 'Ingresos' },
        ]}
      />
      <Card className="p-2">
        {list.map((c) => {
          const parent = c.parentId ? categories.find((p) => p.id === c.parentId) : null;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setEditing(c)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2"
            >
              <CatIcon category={c} />
              <span className="flex-1">
                <span className={c.archived ? 'text-muted line-through' : 'font-medium text-ink'}>
                  {c.name}
                </span>
                {parent && (
                  <span className="block text-xs text-muted">dentro de {parent.name}</span>
                )}
              </span>
              <span className="text-xs text-muted">
                {
                  { needs: 'Necesidad', wants: 'Gusto', savings: 'Ahorro', income: '', none: '' }[
                    c.group
                  ]
                }
              </span>
            </button>
          );
        })}
      </Card>
      <CategorySheet value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function CategorySheet({ value, onClose }: { value: Category | null; onClose: () => void }) {
  const [d, setD] = useState<Category | null>(value);
  const categories = useData((s) => s.data.categories);
  useEffect(() => {
    setD(value);
  }, [value]);
  if (!d) return null;
  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={d.name ? 'Editar categoría' : 'Nueva categoría'}
      footer={
        <Button
          block
          disabled={!d.name}
          onClick={() => {
            void saveDoc('categories', d, 'Categoría guardada');
            onClose();
          }}
        >
          Guardar
        </Button>
      }
    >
      <div className="space-y-4">
        {!(d.system || DEFAULT_IDS.has(d.id)) && (
          <IconPicker value={d.emoji} onChange={(v) => setD({ ...d, emoji: v })} />
        )}
        <div>
          <Input
            label="Nombre"
            value={d.name}
            onChange={(e) => setD({ ...d, name: e.target.value })}
            maxLength={40}
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Color</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => setD({ ...d, color: c })}
                className="h-9 w-9 rounded-full ring-offset-2 ring-offset-surface"
                style={{
                  background: c,
                  boxShadow: d.color === c ? `0 0 0 3px ${c}55` : undefined,
                  outline: d.color === c ? '2px solid var(--ink)' : undefined,
                }}
              />
            ))}
          </div>
        </div>
        {d.type === 'expense' && (
          <Select
            label="Tipo (para 50/30/20)"
            value={d.group}
            onChange={(e) => setD({ ...d, group: e.target.value as Category['group'] })}
            options={[
              { value: 'needs', label: 'Necesidad' },
              { value: 'wants', label: 'Gusto' },
              { value: 'savings', label: 'Ahorro / deudas' },
            ]}
          />
        )}
        <Select
          label="Subcategoría de (opcional)"
          value={d.parentId ?? ''}
          onChange={(e) => setD({ ...d, parentId: e.target.value || null })}
          options={[
            { value: '', label: 'Ninguna' },
            ...categories
              .filter((c) => c.type === d.type && c.id !== d.id && !c.parentId)
              .map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        {!d.system && (
          <Toggle
            label="Archivada"
            description="Se oculta al elegir categoría, pero se conserva el historial."
            checked={d.archived}
            onChange={(v) => setD({ ...d, archived: v })}
          />
        )}
      </div>
    </Sheet>
  );
}
