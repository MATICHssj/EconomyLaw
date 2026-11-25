import { useEffect, useState } from 'react';
import { Loader2, Nfc, Trash2 } from 'lucide-react';
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_ICONS,
  ACCOUNT_TYPE_LABELS,
  INSTITUTIONS,
  bestPurchaseDay,
  type Account,
} from '@fina/core';
import { deleteDoc, newAccount, saveDoc } from '@/lib/actions';
import {
  BRAND_LABELS,
  cancelScan,
  guessInstitution,
  nfcStatus,
  openNfcSettings,
  scanCard,
  type ScannedCard,
} from '@/lib/cardNfc';
import { toast } from '@/stores/ui';
import { Button, Input, MoneyInput, Select, Sheet, Tip, confirmDialog } from '@/components/ui';

const CARD_TYPES: Account['type'][] = ['debit', 'credit', 'voucher'];

export function AccountForm({
  open,
  account,
  onClose,
  defaultType,
}: {
  open: boolean;
  account?: Account | null;
  onClose: () => void;
  defaultType?: Account['type'];
}) {
  const [draft, setDraft] = useState<Account>(() =>
    newAccount({ name: '', type: defaultType ?? 'debit' }),
  );
  useEffect(() => {
    if (open)
      setDraft(
        account
          ? { ...account }
          : newAccount({
              name: '',
              type: defaultType ?? 'debit',
              icon: ACCOUNT_TYPE_ICONS[defaultType ?? 'debit'],
            }),
      );
  }, [open, account, defaultType]);
  const [nfc, setNfc] = useState<{ available: boolean; enabled: boolean }>({
    available: false,
    enabled: false,
  });
  const [scanning, setScanning] = useState(false);
  useEffect(() => {
    if (open) void nfcStatus().then(setNfc);
    else if (scanning) {
      void cancelScan();
      setScanning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = <K extends keyof Account>(k: K, v: Account[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const isCredit = draft.type === 'credit';
  const isCard = CARD_TYPES.includes(draft.type);

  function applyScan(c: ScannedCard) {
    setDraft((d) => {
      const type: Account['type'] = c.kind ?? (CARD_TYPES.includes(d.type) ? d.type : 'debit');
      const institution = d.institution ?? guessInstitution(c.label);
      const inst = INSTITUTIONS.find((i) => i.id === institution);
      const base = inst ? inst.name : BRAND_LABELS[c.brand];
      return {
        ...d,
        type,
        icon: ACCOUNT_TYPE_ICONS[type],
        institution,
        color: inst?.color ?? d.color,
        name:
          d.name ||
          `${base}${type === 'credit' ? ' Crédito' : type === 'debit' ? ' Débito' : ''} •${c.last4}`,
        aliases: Array.from(new Set([...(inst?.aliases ?? d.aliases), c.last4])),
        card: { brand: c.brand, last4: c.last4, expiry: c.expiry, nfc: true },
      };
    });
  }

  async function onScan() {
    if (!nfc.enabled) {
      toast('Activa el NFC de tu teléfono y regresa.', 'info');
      void openNfcSettings();
      return;
    }
    setScanning(true);
    try {
      const card = await scanCard();
      applyScan(card);
      toast(
        `Listo: ${BRAND_LABELS[card.brand]} •${card.last4}${card.expiry ? `, vence ${card.expiry.slice(5)}/${card.expiry.slice(2, 4)}` : ''}`,
        'success',
      );
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'CANCELLED') toast((e as Error).message || 'No pude leer la tarjeta.', 'error');
    } finally {
      setScanning(false);
    }
  }
  const credit = draft.credit ?? {
    limitCents: 0,
    cutoffDay: 5,
    dueDay: 25,
    annualRate: 0.6,
    minPaymentRate: 0.05,
  };

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
                if (
                  await confirmDialog('¿Archivar esta cuenta?', {
                    text: 'Se oculta, pero sus movimientos se conservan.',
                    ok: 'Archivar',
                  })
                ) {
                  await saveDoc('accounts', { ...draft, archived: true }, 'Cuenta archivada');
                  onClose();
                } else if (
                  await confirmDialog('¿Borrarla definitivamente?', {
                    text: 'Sus movimientos se quedan sin cuenta.',
                    danger: true,
                    ok: 'Borrar',
                  })
                ) {
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
              await saveDoc(
                'accounts',
                {
                  ...draft,
                  credit: isCredit ? credit : undefined,
                  icon: draft.icon || ACCOUNT_TYPE_ICONS[draft.type],
                },
                account ? 'Cuenta actualizada' : 'Cuenta creada',
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
        {nfc.available && (!account || isCard) && (
          <div className="rounded-2xl border border-accent-200 bg-accent-50/60 p-3 dark:border-accent-900 dark:bg-accent-950/30">
            {scanning ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-accent-600" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-ink">Acerca tu tarjeta</p>
                  <p className="text-muted">
                    Pégala a la parte de atrás del teléfono y no la muevas hasta que vibre.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void cancelScan();
                    setScanning(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void onScan()}
                className="flex w-full items-center gap-3 text-left"
              >
                <Nfc className="h-6 w-6 shrink-0 text-accent-600" />
                <span className="flex-1 text-sm">
                  <span className="block font-semibold text-ink">Acercar tarjeta (NFC)</span>
                  <span className="text-muted">
                    Lleno la marca, los últimos 4 dígitos y el vencimiento. Nunca guardo el número
                    completo.
                  </span>
                </span>
              </button>
            )}
          </div>
        )}
        <Select
          label="Tipo de cuenta"
          value={draft.type}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              type: e.target.value as Account['type'],
              icon: ACCOUNT_TYPE_ICONS[e.target.value as Account['type']],
            }))
          }
          options={ACCOUNT_TYPES.map((t) => ({
            value: t,
            label: ACCOUNT_TYPE_LABELS[t],
          }))}
        />
        <Select
          label="Banco o app (opcional)"
          value={draft.institution ?? ''}
          onChange={(e) => pickInstitution(e.target.value)}
          options={[
            { value: '', label: 'Ninguno' },
            ...INSTITUTIONS.map((i) => ({ value: i.id, label: i.name })),
          ]}
        />
        <Input
          label="Nombre"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Ej. BBVA nómina"
          maxLength={60}
        />
        <MoneyInput
          label={isCredit ? 'Saldo que debes hoy' : 'Saldo inicial'}
          value={isCredit ? -draft.openingBalanceCents : draft.openingBalanceCents}
          onChange={(v) => set('openingBalanceCents', isCredit ? -v : v)}
          hint={
            account
              ? 'Es el saldo antes de tu primer movimiento. Para corregir el saldo actual usa "Ajustar saldo" en la cuenta.'
              : 'Lo que tienes hoy en esta cuenta.'
          }
        />
        {isCard && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Últimos 4 dígitos"
              inputMode="numeric"
              maxLength={4}
              value={draft.card?.last4 ?? ''}
              placeholder="1234"
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                set('card', {
                  brand: draft.card?.brand ?? 'other',
                  nfc: draft.card?.nfc ?? false,
                  expiry: draft.card?.expiry,
                  last4: v || undefined,
                });
              }}
              hint="Para reconocer los avisos de tu banco."
            />
            <Input
              label="Vence"
              type="month"
              value={draft.card?.expiry ?? ''}
              onChange={(e) =>
                set('card', {
                  brand: draft.card?.brand ?? 'other',
                  nfc: draft.card?.nfc ?? false,
                  last4: draft.card?.last4,
                  expiry: e.target.value || undefined,
                })
              }
              hint="Te aviso antes de que venza."
            />
          </div>
        )}
        {isCredit && (
          <>
            <MoneyInput
              label="Límite de crédito"
              value={credit.limitCents}
              onChange={(v) => set('credit', { ...credit, limitCents: v })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Día de corte"
                type="number"
                min={1}
                max={31}
                value={credit.cutoffDay}
                onChange={(e) =>
                  set('credit', {
                    ...credit,
                    cutoffDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
              <Input
                label="Día límite de pago"
                type="number"
                min={1}
                max={31}
                value={credit.dueDay}
                onChange={(e) =>
                  set('credit', {
                    ...credit,
                    dueDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
            </div>
            <Input
              label="Tasa de interés anual (%)"
              type="number"
              min={0}
              max={300}
              step="0.1"
              value={Math.round(credit.annualRate * 1000) / 10}
              onChange={(e) =>
                set('credit', { ...credit, annualRate: (Number(e.target.value) || 0) / 100 })
              }
              hint="La encuentras en tu estado de cuenta como “tasa de interés anual ordinaria”."
            />
            <Tip>
              Tip: el mejor día para comprar con esta tarjeta es el{' '}
              <b>{bestPurchaseDay(credit.cutoffDay)}</b> (justo después del corte): tienes hasta ~50
              días para pagar sin intereses.
            </Tip>
          </>
        )}
        <Input
          label="Otros nombres (para el parser)"
          value={draft.aliases.join(', ')}
          onChange={(e) =>
            set(
              'aliases',
              e.target.value
                .split(',')
                .map((a) => a.trim())
                .filter(Boolean),
            )
          }
          hint='Ej. "nómina, la azul". Así entiendo "gasolina 500 con la azul".'
        />
      </div>
    </Sheet>
  );
}
