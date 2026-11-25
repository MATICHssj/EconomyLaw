import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { DEDUCTIBLE_CATEGORIES, isFeatureVisible, TX_KINDS, type Transaction } from '@fina/core';
import { deleteTransaction, saveTransaction } from '@/lib/actions';
import { useData } from '@/stores/data';
import { useUI } from '@/stores/ui';
import { Button, Input, MoneyInput, Select, Sheet, Toggle } from '@/components/ui';
import { CategoryPicker } from './CategoryPicker';

const KIND_LABELS: Record<Transaction['kind'], string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia entre cuentas',
  debt_payment: 'Pago de tarjeta / deuda',
  loan_given: 'Presté dinero',
  loan_received: 'Me prestaron',
  loan_collected: 'Me pagaron un préstamo',
  loan_repaid: 'Pagué un préstamo',
  investment: 'Inversión',
  tanda: 'Tanda',
};

export function EditTransactionSheet() {
  const id = useUI((s) => s.editingTxId);
  const close = useUI((s) => s.editTx);
  const tx = useData((s) => s.data.transactions.find((t) => t.id === id));
  const allAccounts = useData((s) => s.data.accounts);
  const accounts = allAccounts.filter((a) => !a.archived || a.id === tx?.accountId);
  const level = useData((s) => s.profile?.level ?? 'basic');
  const trips = useData((s) => s.data.trips);
  const [draft, setDraft] = useState<Transaction | null>(null);

  useEffect(() => {
    setDraft(tx ? { ...tx } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!draft) return null;
  const set = <K extends keyof Transaction>(k: K, v: Transaction[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  const twoAccounts =
    draft.kind === 'transfer' || draft.kind === 'debt_payment' || draft.kind === 'investment';
  const accountOptions = [
    { value: '', label: '— Sin cuenta —' },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
  ];
  const expert = isFeatureVisible(level, 'reconciliation');

  return (
    <Sheet
      open={!!id}
      onClose={() => close(null)}
      title="Editar movimiento"
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            aria-label="Borrar movimiento"
            onClick={() => {
              void deleteTransaction(draft.id);
              close(null);
            }}
          >
            <Trash2 className="h-5 w-5 text-rose-600" />
          </Button>
          <Button
            block
            onClick={() => {
              void saveTransaction(draft);
              close(null);
            }}
          >
            Guardar cambios
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput
            label="Monto"
            value={draft.amountCents}
            onChange={(v) => set('amountCents', v)}
          />
          <Input
            label="Fecha"
            type="date"
            value={draft.date}
            onChange={(e) => e.target.value && set('date', e.target.value)}
          />
        </div>
        <Input
          label="Descripción"
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={120}
        />
        <Select
          label="Tipo"
          value={draft.kind}
          onChange={(e) => set('kind', e.target.value as Transaction['kind'])}
          options={TX_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
        />
        {(draft.kind === 'expense' || draft.kind === 'income') && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Categoría</p>
            <CategoryPicker
              value={draft.categoryId}
              type={draft.kind === 'income' ? 'income' : 'expense'}
              onChange={(c) => set('categoryId', c)}
            />
            {draft.rawText && (
              <p className="mt-1.5 text-xs text-muted">
                Si cambias la categoría, {`${'Fina'}`} aprenderá para la próxima vez.
              </p>
            )}
          </div>
        )}
        <div className={twoAccounts ? 'grid grid-cols-2 gap-3' : ''}>
          <Select
            label={twoAccounts ? 'Desde' : 'Cuenta'}
            value={draft.accountId ?? ''}
            onChange={(e) => set('accountId', e.target.value || null)}
            options={accountOptions}
          />
          {twoAccounts && (
            <Select
              label="Hacia"
              value={draft.toAccountId ?? ''}
              onChange={(e) => set('toAccountId', e.target.value || null)}
              options={accountOptions}
            />
          )}
        </div>
        {draft.myShareCents !== undefined && (
          <MoneyInput
            label="Tu parte (gasto compartido)"
            value={draft.myShareCents}
            onChange={(v) => set('myShareCents', v)}
            hint="Solo tu parte cuenta como gasto en tus reportes."
          />
        )}
        <Input
          label="Etiquetas"
          value={draft.tags.map((t) => `#${t}`).join(' ')}
          placeholder="#viaje #negocio"
          onChange={(e) =>
            set(
              'tags',
              e.target.value
                .split(/[\s,]+/)
                .map((t) => t.replace(/^#/, '').toLowerCase())
                .filter(Boolean),
            )
          }
        />
        {draft.kind === 'expense' && trips.length > 0 && (
          <Select
            label="Viaje"
            value={draft.tripId ?? ''}
            onChange={(e) => set('tripId', e.target.value || undefined)}
            options={[
              { value: '', label: 'No es de un viaje' },
              ...trips
                .filter((t) => !t.archived || t.id === draft.tripId)
                .map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        )}
        <Input
          label="Nota"
          value={draft.note ?? ''}
          onChange={(e) => set('note', e.target.value || undefined)}
          maxLength={500}
        />
        {expert && (
          <>
            <Select
              label="Deducible (SAT)"
              value={draft.deductible ?? ''}
              onChange={(e) => set('deductible', e.target.value || undefined)}
              options={[
                { value: '', label: 'No es deducible' },
                ...DEDUCTIBLE_CATEGORIES.map((d) => ({
                  value: d.id,
                  label: d.name,
                })),
              ]}
            />
            <Toggle
              label="Conciliado"
              description="Ya lo verificaste contra tu estado de cuenta."
              checked={draft.reconciled}
              onChange={(v) => set('reconciled', v)}
            />
          </>
        )}
        {draft.rawText && (
          <p className="text-xs text-muted">
            Escribiste: “{draft.rawText}” · vía {draft.source}
          </p>
        )}
      </div>
    </Sheet>
  );
}
