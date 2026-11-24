import { Link } from 'react-router';
import { useMemo } from 'react';
import { coupleBalance, monthKey, monthStart, todayISO } from '@fina/core';
import { useData } from '@/stores/data';
import { useSession } from '@/stores/session';
import { Card, CardTitle, Money } from '@/components/ui';

/** "Cuentas claras": quién ha pagado más de los gastos comunes este mes. */
export function CoupleCard() {
  const household = useData((s) => s.household);
  const txs = useData((s) => s.data.transactions);
  const uid = useSession((s) => s.user?.uid);
  const balance = useMemo(() => {
    if (!household) return null;
    const from = monthStart(monthKey(todayISO()));
    return coupleBalance(household, txs.filter((t) => t.space === 'household' && t.date >= from));
  }, [household, txs]);
  if (!household || !balance || balance.totalSharedCents === 0) return null;
  const names = Object.fromEntries(balance.members.map((m) => [m.uid, m.uid === uid ? 'Tú' : m.name]));
  return (
    <Card>
      <CardTitle action={<Link to="/hogar" className="text-sm font-semibold text-accent-600">Ver</Link>}>🏠 {household.name} este mes</CardTitle>
      <div className="grid grid-cols-2 gap-2">
        {balance.members.map((m) => (
          <div key={m.uid} className="rounded-xl bg-surface-2 p-2.5">
            <div className="text-xs text-muted">{names[m.uid]} pagó</div>
            <Money cents={m.paidCents} className="font-bold text-ink" />
          </div>
        ))}
      </div>
      {balance.settlement ? (
        <p className="mt-3 text-sm text-ink">
          Para quedar a mano: <b>{names[balance.settlement.fromUid]}</b> → <b>{names[balance.settlement.toUid]}</b> <Money cents={balance.settlement.amountCents} className="font-bold" />
        </p>
      ) : (
        <p className="mt-3 text-sm text-income">¡Están a mano! 🤝</p>
      )}
    </Card>
  );
}
