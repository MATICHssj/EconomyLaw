import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { newId, normalizeText, type Rule } from '@fina/core';
import { deleteDoc, saveDoc } from '@/lib/actions';
import { useCategoryMap } from '@/lib/finance';
import { useData } from '@/stores/data';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Sheet,
  Tip,
} from '@/components/ui';
import { CategoryPicker } from '@/features/transactions/CategoryPicker';

export default function RulesPage() {
  const rules = useData((s) => s.data.rules);
  const accounts = useData((s) => s.data.accounts);
  const catMap = useCategoryMap();
  const [editing, setEditing] = useState<Rule | null>(null);
  const sorted = [...rules].sort(
    (a, b) => Number(a.learned) - Number(b.learned) || b.priority - a.priority,
  );
  const blank = (): Rule => ({
    id: newId(),
    match: { contains: '' },
    set: {},
    priority: 20,
    learned: false,
    hits: 0,
    createdAt: new Date().toISOString(),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reglas automáticas"
        back
        actions={
          <Button size="sm" onClick={() => setEditing(blank())}>
            <Plus className="h-4 w-4" /> Regla
          </Button>
        }
      />
      <Tip>
        Ejemplo: si el texto contiene <b>oxxo</b> → categoría Tiendita y cuenta Efectivo. Las reglas
        “aprendidas” las creo yo cuando corriges una categoría.
      </Tip>
      {sorted.length === 0 ? (
        <EmptyState
          emoji="⚙️"
          title="Sin reglas todavía"
          text="Crea una o corrige la categoría de un movimiento y la aprendo sola."
        />
      ) : (
        <Card className="p-2">
          {sorted.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setEditing(r)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">
                  Si dice “{r.match.contains ?? r.match.merchant}”{' '}
                  {r.learned && <Badge tone="accent">aprendida</Badge>}
                </p>
                <p className="text-sm text-muted">
                  →{' '}
                  {r.set.categoryId
                    ? `${catMap.get(r.set.categoryId)?.emoji ?? ''} ${catMap.get(r.set.categoryId)?.name ?? r.set.categoryId}`
                    : 'sin cambiar categoría'}
                  {r.set.accountId &&
                    ` · ${accounts.find((a) => a.id === r.set.accountId)?.name ?? ''}`}
                  {r.set.tags?.length ? ` · ${r.set.tags.map((t) => `#${t}`).join(' ')}` : ''}
                </p>
              </div>
            </button>
          ))}
        </Card>
      )}
      <RuleSheet value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function RuleSheet({ value, onClose }: { value: Rule | null; onClose: () => void }) {
  const [d, setD] = useState<Rule | null>(value);
  const accounts = useData((s) => s.data.accounts);
  const exists = useData((s) => s.data.rules.some((r) => r.id === value?.id));
  useEffect(() => {
    setD(value);
  }, [value]);
  if (!d) return null;
  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={exists ? 'Editar regla' : 'Nueva regla'}
      footer={
        <div className="flex gap-2">
          {exists && (
            <Button
              variant="secondary"
              aria-label="Borrar"
              onClick={() => {
                void deleteDoc('rules', d.id, 'Regla borrada');
                onClose();
              }}
            >
              <Trash2 className="h-5 w-5 text-rose-600" />
            </Button>
          )}
          <Button
            block
            disabled={!d.match.contains?.trim()}
            onClick={() => {
              void saveDoc(
                'rules',
                { ...d, match: { contains: normalizeText(d.match.contains ?? '') } },
                'Regla guardada',
              );
              onClose();
            }}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Si el texto contiene…"
          value={d.match.contains ?? ''}
          onChange={(e) => setD({ ...d, match: { contains: e.target.value } })}
          placeholder="oxxo"
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">…ponle la categoría</p>
          <CategoryPicker
            value={d.set.categoryId ?? null}
            onChange={(c) => setD({ ...d, set: { ...d.set, categoryId: c } })}
          />
        </div>
        <Select
          label="…y la cuenta (opcional)"
          value={d.set.accountId ?? ''}
          onChange={(e) =>
            setD({ ...d, set: { ...d.set, accountId: e.target.value || undefined } })
          }
          options={[
            { value: '', label: 'No cambiar' },
            ...accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
        <Input
          label="…y las etiquetas (opcional)"
          value={(d.set.tags ?? []).map((t) => `#${t}`).join(' ')}
          onChange={(e) =>
            setD({
              ...d,
              set: {
                ...d.set,
                tags: e.target.value
                  .split(/[\s,]+/)
                  .map((t) => t.replace(/^#/, '').toLowerCase())
                  .filter(Boolean),
              },
            })
          }
          placeholder="#negocio"
        />
      </div>
    </Sheet>
  );
}
