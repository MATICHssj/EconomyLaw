import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ACCOUNT_TYPE_LABELS, LIABILITY_TYPES, type Account } from '@fina/core';
import { useFinance } from '@/lib/finance';
import { useDocs } from '@/stores/data';
import { Button, Card, EmptyState, ListItem, Money, PageHeader, Stat } from '@/components/ui';
import { AccountForm } from './AccountForm';
import { SpaceSwitcher } from '@/features/household/SpaceSwitcher';

const GROUPS: Array<{ label: string; types: Account['type'][] }> = [
  { label: 'Para gastar', types: ['cash', 'debit', 'wallet', 'voucher'] },
  { label: 'Tarjetas y créditos', types: ['credit', 'loan'] },
  { label: 'Ahorro e inversión', types: ['savings', 'investment'] },
];

export default function AccountsPage() {
  const accounts = useDocs('accounts');
  const f = useFinance();
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const active = accounts.filter((a) => showArchived || !a.archived);
  const savings = accounts.filter((a) => !a.archived && (a.type === 'savings' || a.type === 'investment')).reduce((s, a) => s + (f.balances[a.id] ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cuentas"
        back
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva
          </Button>
        }
      />
      <SpaceSwitcher />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Disponible" value={<Money cents={f.available} />} />
        <Stat label="Debes en tarjetas" value={<Money cents={f.owed} />} />
        <Stat label="Ahorro" value={<Money cents={savings} />} />
      </div>
      {accounts.length === 0 ? (
        <EmptyState emoji="🏦" title="Agrega tu primera cuenta" text="Efectivo, débito, tarjetas, Mercado Pago, vales… Nunca te pedimos contraseñas: solo el nombre y el saldo." action={<Button onClick={() => setOpen(true)}>Agregar cuenta</Button>} />
      ) : (
        GROUPS.map((g) => {
          const list = active.filter((a) => g.types.includes(a.type));
          if (!list.length) return null;
          const total = list.reduce((s, a) => s + (f.balances[a.id] ?? 0), 0);
          return (
            <Card key={g.label} className="p-2">
              <div className="flex items-center justify-between px-2 pt-1 pb-2">
                <h2 className="font-semibold text-ink">{g.label}</h2>
                <Money cents={total} className="text-sm font-semibold text-muted" />
              </div>
              {list.map((a) => {
                const bal = f.balances[a.id] ?? 0;
                return (
                  <ListItem
                    key={a.id}
                    to={`/cuentas/${a.id}`}
                    icon={<span style={{ color: a.color }}>{a.icon}</span>}
                    title={
                      <>
                        {a.name} {a.archived && <span className="text-xs text-muted">(archivada)</span>} {a.space === 'household' && '🏠'}
                      </>
                    }
                    subtitle={ACCOUNT_TYPE_LABELS[a.type]}
                    right={
                      LIABILITY_TYPES.has(a.type) ? (
                        <div>
                          <Money cents={Math.max(0, -bal)} className="font-semibold text-ink" />
                          <div className="text-xs text-muted">debes</div>
                        </div>
                      ) : (
                        <Money cents={bal} className="font-semibold text-ink" />
                      )
                    }
                  />
                );
              })}
            </Card>
          );
        })
      )}
      {accounts.some((a) => a.archived) && (
        <button type="button" className="w-full text-center text-sm text-muted" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Ocultar archivadas' : 'Ver cuentas archivadas'}
        </button>
      )}
      <AccountForm open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
