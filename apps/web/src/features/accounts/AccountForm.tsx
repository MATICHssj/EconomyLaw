import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS, INSTITUTIONS, bestPurchaseDay, type Account } from '@fina/core';
import { deleteDoc, newAccount, saveDoc } from '@/lib/actions';
import { Button, Input, MoneyInput, Select, Sheet, Tip, confirmDialog } from '@/components/ui';

export function AccountForm({ open, account, onClose, defaultType }: { open: boolean; account?: Account | null; onClose: () => void; defaultType?: Account['type'] }) {
  const [draft, setDraft] = useState<Account>(() => newAccount({ name: '', type: defaultType ?? 'debit' }));
  useEffect(() => {
    if (open) setDraft(account ? { ...account } : newAccount({ name: '', type: defaultType ?? 'debit', icon: ACCOUNT_TYPE_ICONS[defaultType ?? 'debit'] }));
  }, [open, account, defaultType]);
  const set = <K extends keyof Account>(k: K, v: Account[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const isCredit = draft.type === 'credit';
  const credit = draft.credit ?? { limitCents: 0, cutoffDay: 5, dueDay: 25, annualRate: 0.6, minPaymentRate: 0.05 };

  function pickInstitution(id: string) {
    const inst = INSTITUTIONS.find((i) => i.id === id);
    setDraft((d) => ({
      ...d,
      institution: id || undefined,
      color: inst?.color ?? d.color,
      name: d.name || (inst ? (d.type === 'credit' ? `${inst.name} Crédito` : inst.name) : d.name),
      aliases: inst ? inst.aliases : d.aliases,
    }));
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={account ? 'Editar cuenta' : 'Nueva cuenta'}
      footer={
        <div className="flex gap-2">
          {account && (
            <Button
              variant="secondary"
              aria-label="Archivar o borrar"
              onClick={async () => {
                if (await confirmDialog('¿Archivar esta cuenta?', { text: 'Se oculta, pero sus movimientos se conservan.', ok: 'Archivar' })) {
                  await saveDoc('accounts', { ...draft, archived: true }, 'Cuenta archivada');
                  onClose();
                } else if (await confirmDialog('¿Borrarla definitivamente?', { text: 'Sus movimientos se quedan sin cuenta.', danger: true, ok: 'Borrar' })) {
                  await deleteDoc('accounts', draft.id, 'Cuenta borrada');
                  onClose();
                }
              }}
            >
              <Trash2 className="h-5 w-5 text-rose-600" />
            </Button>
          )}
          <Button
            block
            disabled={!draft.name.trim()}
            onClick={async () => {
              await saveDoc('accounts', { ...draft, credit: isCredit ? credit : undefined, icon: draft.icon || ACCOUNT_TYPE_ICONS[draft.type] }, account ? 'Cuenta actualizada' : 'Cuenta creada');
              onClose();
            }}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Select label="Tipo de cuenta" value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as Account['type'], icon: ACCOUNT_TYPE_ICONS[e.target.value as Account['type']] }))} options={ACCOUNT_TYPES.map((t) => ({ value: t, label: `${ACCOUNT_TYPE_ICONS[t]} ${ACCOUNT_TYPE_LABELS[t]}` }))} />
        <Select label="Banco o app (opcional)" value={draft.institution ?? ''} onChange={(e) => pickInstitution(e.target.value)} options={[{ value: '', label: 'Ninguno' }, ...INSTITUTIONS.map((i) => ({ value: i.id, label: i.name }))]} />
        <Input label="Nombre" value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. BBVA nómina" maxLength={60} />
        <MoneyInput
          label={isCredit ? 'Saldo que debes hoy' : 'Saldo inicial'}
          value={isCredit ? -draft.openingBalanceCents : draft.openingBalanceCents}
          onChange={(v) => set('openingBalanceCents', isCredit ? -v : v)}
          hint={account ? 'Es el saldo antes de tu primer movimiento. Para corregir el saldo actual usa "Ajustar saldo" en la cuenta.' : 'Lo que tienes hoy en esta cuenta.'}
        />
        {isCredit && (
          <>
            <MoneyInput label="Límite de crédito" value={credit.limitCents} onChange={(v) => set('credit', { ...credit, limitCents: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Día de corte" type="number" min={1} max={31} value={credit.cutoffDay} onChange={(e) => set('credit', { ...credit, cutoffDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
              <Input label="Día límite de pago" type="number" min={1} max={31} value={credit.dueDay} onChange={(e) => set('credit', { ...credit, dueDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
            </div>
            <Input label="Tasa de interés anual (%)" type="number" min={0} max={300} step="0.1" value={Math.round(credit.annualRate * 1000) / 10} onChange={(e) => set('credit', { ...credit, annualRate: (Number(e.target.value) || 0) / 100 })} hint="La encuentras en tu estado de cuenta como “tasa de interés anual ordinaria”." />
            <Tip>
              Tip: el mejor día para comprar con esta tarjeta es el <b>{bestPurchaseDay(credit.cutoffDay)}</b> (justo después del corte): tienes hasta ~50 días para pagar sin intereses.
            </Tip>
          </>
        )}
        <Input label="Otros nombres (para el parser)" value={draft.aliases.join(', ')} onChange={(e) => set('aliases', e.target.value.split(',').map((a) => a.trim()).filter(Boolean))} hint='Ej. "nómina, la azul". Así entiendo "gasolina 500 con la azul".' />
      </div>
    </Sheet>
  );
}
