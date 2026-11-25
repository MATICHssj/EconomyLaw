import { useMemo, useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import {
  coupleBalance,
  formatMonthKey,
  monthEnd,
  monthKey,
  monthStart,
  todayISO,
  type Household,
} from '@fina/core';
import { hasCloud } from '@/config';
import {
  createHousehold,
  createInvite,
  joinHousehold,
  leaveHousehold,
  updateHousehold,
} from '@/lib/household';
import { useData } from '@/stores/data';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/ui';
import {
  Button,
  Card,
  CardTitle,
  Input,
  Money,
  MoneyInput,
  PageHeader,
  Segmented,
  Tip,
  confirmDialog,
} from '@/components/ui';

export default function HouseholdPage() {
  const household = useData((s) => s.household);
  const mode = useSession((s) => s.mode);
  if (!hasCloud() || mode !== 'firebase') return <NeedsAccount />;
  return household ? <HouseholdView household={household} /> : <Setup />;
}

function NeedsAccount() {
  return (
    <div className="space-y-4">
      <PageHeader title="Pareja / familia" back />
      <Card className="text-center">
        <p className="text-5xl">💑</p>
        <h2 className="mt-2 text-xl font-bold text-ink">Lleven juntos el dinero de la casa</h2>
        <p className="mt-2 text-muted">
          Gastos comunes, presupuesto compartido y “cuentas claras”: quién ha puesto más y cuánto le
          toca a cada quien (50/50 o según lo que gana cada uno). Sus cuentas personales siguen
          siendo privadas.
        </p>
        <p className="mt-4 text-sm text-muted">
          {hasCloud()
            ? 'Para compartir necesitas entrar con tu cuenta (Ajustes → Cuenta).'
            : 'Esta función se activa cuando la app esté conectada a la nube (Firebase).'}
        </p>
      </Card>
    </div>
  );
}

function Setup() {
  const income = useData((s) => s.profile?.monthlyIncomeCents);
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('Nuestra casa');
  const [splitMode, setSplitMode] = useState<Household['splitMode']>('equal');
  const [code, setCode] = useState('');
  const [myIncome, setMyIncome] = useState(income ?? 0);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Pareja / familia" back />
      <Card className="bg-gradient-to-br from-rose-50 to-accent-50 dark:from-rose-950/40 dark:to-accent-950/40">
        <p className="text-4xl">💑</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Finanzas en pareja, sin pleitos</h2>
        <ul className="mt-2 space-y-1 text-sm text-ink">
          <li>🏠 Un espacio compartido para la renta, el súper y los servicios.</li>
          <li>🔒 Tus cuentas personales siguen siendo solo tuyas.</li>
          <li>⚖️ “Cuentas claras”: quién ha pagado más y cuánto transferir para quedar a mano.</li>
          <li>🎯 Metas juntos: viaje, enganche, boda…</li>
        </ul>
      </Card>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'create', label: 'Crear hogar' },
          { value: 'join', label: 'Tengo un código' },
        ]}
      />
      {tab === 'create' ? (
        <Card className="space-y-4">
          <Input label="Nombre del hogar" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">
              ¿Cómo se reparten los gastos comunes?
            </p>
            <Segmented
              value={splitMode}
              onChange={setSplitMode}
              options={[
                { value: 'equal', label: '50 / 50' },
                { value: 'income', label: 'Según ingreso' },
              ]}
            />
            <p className="mt-1.5 text-xs text-muted">
              {splitMode === 'equal'
                ? 'Cada quien pone la mitad.'
                : 'Quien gana más pone más (p. ej. 60/40). Es lo más justo cuando los sueldos son distintos.'}
            </p>
          </div>
          {splitMode === 'income' && (
            <MoneyInput
              label="Tu ingreso mensual (solo se usa para el porcentaje)"
              value={myIncome}
              onChange={setMyIncome}
            />
          )}
          <Button
            block
            disabled={busy || !name}
            onClick={() => void run(() => createHousehold(name, splitMode, myIncome || undefined))}
          >
            Crear e invitar a mi pareja
          </Button>
        </Card>
      ) : (
        <Card className="space-y-4">
          <Input
            label="Código de invitación"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            autoCapitalize="characters"
          />
          <MoneyInput
            label="Tu ingreso mensual (opcional)"
            value={myIncome}
            onChange={setMyIncome}
            hint="Solo si van a repartir según ingreso."
          />
          <Button
            block
            disabled={busy || code.length < 6}
            onClick={() => void run(() => joinHousehold(code, myIncome || undefined))}
          >
            Unirme
          </Button>
        </Card>
      )}
    </div>
  );
}

function HouseholdView({ household }: { household: Household }) {
  const txs = useData((s) => s.data.transactions);
  const uid = useSession((s) => s.user?.uid);
  const [code, setCode] = useState<string | null>(null);
  const [month] = useState(monthKey(todayISO()));
  const balance = useMemo(
    () =>
      coupleBalance(
        household,
        txs.filter(
          (t) =>
            t.space === 'household' && t.date >= monthStart(month) && t.date <= monthEnd(month),
        ),
      ),
    [household, txs, month],
  );
  const names = (id: string) => (id === uid ? 'Tú' : (household.memberNames[id] ?? 'Integrante'));

  async function invite() {
    try {
      const c = await createInvite(household.id);
      setCode(c);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  const shareText = code
    ? `Únete a nuestro hogar en Fina para llevar juntos los gastos 💑. Abre la app → Más → Pareja / familia → "Tengo un código" y escribe: ${code}`
    : '';

  return (
    <div className="space-y-4">
      <PageHeader
        title={`🏠 ${household.name}`}
        subtitle={`${household.members.length} integrantes`}
        back
      />
      <Card>
        <CardTitle>Cuentas claras · {formatMonthKey(month)}</CardTitle>
        <p className="text-sm text-muted">
          Gastos compartidos:{' '}
          <Money cents={balance.totalSharedCents} className="font-semibold text-ink" /> · reparto{' '}
          {household.splitMode === 'equal' ? '50/50' : 'según ingreso'}
        </p>
        <div className="mt-3 space-y-2">
          {balance.members.map((m) => (
            <div
              key={m.uid}
              className="flex items-center justify-between rounded-xl bg-surface-2 p-3"
            >
              <span className="font-medium text-ink">{names(m.uid)}</span>
              <span className="text-right text-sm">
                pagó <Money cents={m.paidCents} className="font-semibold text-ink" />
                <span className="block text-xs text-muted">
                  le toca <Money cents={m.fairShareCents} />
                </span>
              </span>
            </div>
          ))}
        </div>
        {balance.settlement ? (
          <p className="mt-3 rounded-xl bg-accent-50 p-3 text-ink dark:bg-accent-950/50">
            Para quedar a mano: <b>{names(balance.settlement.fromUid)}</b> le transfiere{' '}
            <Money cents={balance.settlement.amountCents} className="font-bold" /> a{' '}
            <b>{names(balance.settlement.toUid)}</b>.
          </p>
        ) : (
          <p className="mt-3 text-income">¡Están a mano! 🤝</p>
        )}
      </Card>
      <Card className="space-y-3">
        <CardTitle>Invitar</CardTitle>
        {code ? (
          <>
            <p className="text-center text-4xl font-extrabold tracking-[0.3em] text-accent-600">
              {code}
            </p>
            <p className="text-center text-sm text-muted">Válido por 7 días.</p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                block
                onClick={() =>
                  void navigator.clipboard.writeText(code).then(() => toast('Código copiado'))
                }
              >
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button
                block
                onClick={() =>
                  navigator.share
                    ? void navigator.share({ text: shareText }).catch(() => {})
                    : window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
                }
              >
                <Share2 className="h-4 w-4" /> Compartir
              </Button>
            </div>
          </>
        ) : (
          <Button block variant="soft" onClick={() => void invite()}>
            Generar código de invitación
          </Button>
        )}
      </Card>
      <Card className="space-y-3">
        <CardTitle>Reparto de gastos</CardTitle>
        <Segmented
          value={household.splitMode}
          onChange={(v) => void updateHousehold(household.id, { splitMode: v })}
          options={[
            { value: 'equal', label: '50 / 50' },
            { value: 'income', label: 'Según ingreso' },
          ]}
        />
        {household.splitMode === 'income' && (
          <div className="space-y-2">
            {household.members.map((m) => (
              <MoneyInput
                key={m}
                label={`Ingreso de ${names(m)}`}
                value={household.weights[m] ?? 0}
                onChange={(v) =>
                  void updateHousehold(household.id, { weights: { ...household.weights, [m]: v } })
                }
              />
            ))}
          </div>
        )}
      </Card>
      <Tip>
        Para registrar un gasto común, elige “🏠 {household.name}” al anotar, o cambia arriba a la
        vista del hogar. Crea cuentas y metas compartidas desde esa vista.
      </Tip>
      <Button
        variant="ghost"
        className="w-full text-rose-600"
        onClick={async () => {
          if (
            await confirmDialog('¿Salir del hogar?', {
              text: 'Dejarás de ver los gastos compartidos. Tus datos personales no se tocan.',
              danger: true,
              ok: 'Salir',
            })
          )
            await leaveHousehold(household.id);
        }}
      >
        Salir del hogar
      </Button>
    </div>
  );
}
