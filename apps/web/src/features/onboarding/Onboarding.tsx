import { EmojiIcon, LEVEL_ICONS } from '@/components/icons';
import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import {
  ACCOUNT_TYPE_ICONS,
  BRAND,
  INSTITUTIONS,
  LEVEL_INFO,
  type AccountType,
  type Level,
  type Profile,
} from '@fina/core';
import { parse } from '@fina/parser';
import { applyChanges, loadDemoData, newAccount, parseContext } from '@/lib/actions';
import { useData } from '@/stores/data';
import { useSession } from '@/stores/session';
import { Button, Chip, Input, MoneyInput, cx } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { EntryPreview } from '@/features/capture/EntryPreview';

const QUICK_ACCOUNTS: Array<{ id: string; type: AccountType; label: string }> = [
  { id: 'cash', type: 'cash', label: 'Efectivo' },
  { id: 'bbva', type: 'debit', label: 'BBVA' },
  { id: 'nu', type: 'credit', label: 'Nu' },
  { id: 'mercadopago', type: 'wallet', label: 'Mercado Pago' },
  { id: 'santander', type: 'debit', label: 'Santander' },
  { id: 'banorte', type: 'debit', label: 'Banorte' },
  { id: 'banamex', type: 'debit', label: 'Banamex' },
  { id: 'hsbc', type: 'debit', label: 'HSBC' },
  { id: 'azteca', type: 'debit', label: 'Banco Azteca' },
  { id: 'spin', type: 'wallet', label: 'Spin by OXXO' },
  { id: 'hey', type: 'debit', label: 'Hey Banco' },
  { id: 'stori', type: 'credit', label: 'Stori' },
  { id: 'edenred', type: 'voucher', label: 'Vales' },
];

const STEPS = ['welcome', 'name', 'level', 'payday', 'accounts', 'try'] as const;

/** Bienvenida guiada: nombre, nivel, quincena, cuentas y tu primer gasto. */
export function Onboarding() {
  const user = useSession((s) => s.user);
  const updateProfile = useData((s) => s.updateProfile);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name?.split(' ')[0] ?? '');
  const [level, setLevel] = useState<Level>('basic');
  const [payday, setPayday] = useState<Profile['payday']>({ type: 'biweekly', days: [15, 30] });
  const [income, setIncome] = useState(0);
  const [accounts, setAccounts] = useState<Record<string, { selected: boolean; balance: number }>>({
    cash: { selected: true, balance: 0 },
  });
  const [tryText, setTryText] = useState('');
  const current = STEPS[step]!;
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const tryResult = tryText ? parse(tryText, parseContext()) : null;

  async function finish(withDemo = false) {
    const selected =
      level === 'basic'
        ? [['cash', { selected: true, balance: accounts.cash?.balance ?? 0 }] as const]
        : Object.entries(accounts).filter(([, v]) => v.selected);
    const accDocs = selected.map(([id, v]) => {
      const inst = INSTITUTIONS.find((i) => i.id === id)!;
      const quick = QUICK_ACCOUNTS.find((q) => q.id === id)!;
      return newAccount({
        name:
          level === 'basic'
            ? 'Mi dinero'
            : quick.type === 'credit'
              ? `${inst.name} Crédito`
              : inst.name,
        type: quick.type,
        institution: id,
        color: inst.color,
        icon: ACCOUNT_TYPE_ICONS[quick.type],
        openingBalanceCents: quick.type === 'credit' ? -v.balance : v.balance,
        credit:
          quick.type === 'credit'
            ? { limitCents: 0, cutoffDay: 5, dueDay: 25, annualRate: 0.6, minPaymentRate: 0.05 }
            : undefined,
      });
    });
    const existing = useData.getState().data.accounts;
    if (!existing.length)
      await applyChanges(
        accDocs.map((doc) => ({
          space: 'personal' as const,
          col: 'accounts' as const,
          before: null,
          after: doc,
        })),
      );
    await updateProfile({
      name,
      level,
      payday,
      monthlyIncomeCents: income || undefined,
      currency: 'MXN',
      locale: 'es-MX',
      email: user?.email,
      onboarded: true,
      createdAt: new Date().toISOString(),
    });
    if (withDemo) await loadDemoData();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="mb-6 flex items-center gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={back}
            aria-label="Regresar"
            className="rounded-full p-2 text-muted hover:bg-surface-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="h-9 w-9" />
        )}
        <div className="flex flex-1 gap-1.5" aria-label={`Paso ${step + 1} de ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cx(
                'h-1.5 flex-1 rounded-full transition',
                i <= step ? 'bg-accent-600' : 'bg-line',
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex-1">
        {current === 'welcome' && (
          <div className="flex h-full flex-col justify-center gap-6 py-8">
            <Logo size="lg" />
            <h1 className="text-3xl leading-tight font-bold text-ink">{BRAND.slogan}</h1>
            <div className="space-y-3">
              {[
                [
                  'i:sparkles',
                  'Anota en 3 segundos',
                  'Escribe "tacos 120" y listo. Yo adivino la categoría, la cuenta y la fecha.',
                ],
                [
                  'i:sprout',
                  'Crece contigo',
                  'Empieza fácil y, cuando quieras, activa presupuestos, MSI, deudas, inversiones y SAT.',
                ],
                [
                  'i:people',
                  'Solo o en pareja',
                  'Lleven juntos los gastos de la casa con cuentas claras.',
                ],
                [
                  'i:book',
                  'Aprende mientras usas',
                  'Misiones y lecciones cortitas para que tu dinero rinda más.',
                ],
              ].map(([e, t, d]) => (
                <div key={t} className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-200">
                    <EmojiIcon emoji={e} className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{t}</p>
                    <p className="text-sm text-muted">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {current === 'name' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-ink">¿Cómo te llamas?</h1>
            <p className="text-muted">Para saludarte como se debe.</p>
            <Input
              aria-label="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              autoFocus
              autoComplete="given-name"
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
          </div>
        )}

        {current === 'level' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-ink">¿Cómo quieres llevar tu dinero?</h1>
            <p className="text-muted">
              Puedes cambiarlo cuando quieras. Nunca pierdes información.
            </p>
            <div className="space-y-3" role="radiogroup">
              {(['basic', 'organized', 'expert'] as Level[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={level === l}
                  onClick={() => setLevel(l)}
                  className={cx(
                    'w-full rounded-2xl border-2 p-4 text-left transition',
                    level === l
                      ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40'
                      : 'border-line bg-surface hover:border-accent-300',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <LevelIcon level={l} />
                    <span className="text-lg font-bold text-ink">{LEVEL_INFO[l].label}</span>
                    {level === l && <Check className="ml-auto h-5 w-5 text-accent-600" />}
                  </div>
                  <p className="mt-1 font-medium text-ink">“{LEVEL_INFO[l].tagline}”</p>
                  <p className="mt-1 text-sm text-muted">{LEVEL_INFO[l].description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {current === 'payday' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-ink">¿Cuándo te pagan?</h1>
            <p className="text-muted">
              Así te digo cuánto puedes gastar al día hasta tu siguiente pago.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['Quincena (15 y 30)', { type: 'biweekly', days: [15, 30] }],
                  ['Cada mes', { type: 'monthly', days: [30] }],
                  ['Cada semana', { type: 'weekly', days: [5] }],
                  ['Variable / freelance', { type: 'irregular', days: [] }],
                ] as Array<[string, Profile['payday']]>
              ).map(([label, p]) => (
                <Chip
                  key={label}
                  active={payday.type === p.type}
                  onClick={() => setPayday(p)}
                  className="justify-center py-3"
                >
                  {label}
                </Chip>
              ))}
            </div>
            {payday.type === 'monthly' && (
              <Input
                label="¿Qué día del mes?"
                type="number"
                min={1}
                max={31}
                value={payday.days[0] ?? 30}
                onChange={(e) =>
                  setPayday({ type: 'monthly', days: [Number(e.target.value) || 30] })
                }
              />
            )}
            {payday.type === 'weekly' && (
              <div className="flex flex-wrap gap-2">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => (
                  <Chip
                    key={d}
                    active={payday.days[0] === i}
                    onClick={() => setPayday({ type: 'weekly', days: [i] })}
                  >
                    {d}
                  </Chip>
                ))}
              </div>
            )}
            <MoneyInput
              label="¿Cuánto ganas al mes, más o menos? (opcional)"
              value={income}
              onChange={setIncome}
              hint="Solo se usa para tus cálculos (50/30/20, salud financiera). Nadie más lo ve."
            />
          </div>
        )}

        {current === 'accounts' && (
          <div className="space-y-4">
            {level === 'basic' ? (
              <>
                <h1 className="text-2xl font-bold text-ink">¿Cuánto dinero traes hoy?</h1>
                <p className="text-muted">
                  Suma lo que tienes en efectivo y en tu cuenta. Es opcional: también puedes empezar
                  desde cero.
                </p>
                <MoneyInput
                  label="Mi dinero hoy"
                  value={accounts.cash?.balance ?? 0}
                  onChange={(v) => setAccounts({ cash: { selected: true, balance: v } })}
                />
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-ink">¿Qué cuentas usas?</h1>
                <p className="text-muted">
                  Elige las tuyas y, si quieres, pon su saldo actual. Las tarjetas de crédito se
                  configuran después (corte y pago).
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACCOUNTS.map((a) => (
                    <Chip
                      key={a.id}
                      active={!!accounts[a.id]?.selected}
                      onClick={() =>
                        setAccounts((s) => ({
                          ...s,
                          [a.id]: { selected: !s[a.id]?.selected, balance: s[a.id]?.balance ?? 0 },
                        }))
                      }
                    >
                      {a.label}
                      {a.type === 'credit' && ' (crédito)'}
                    </Chip>
                  ))}
                </div>
                <div className="space-y-3">
                  {Object.entries(accounts)
                    .filter(([, v]) => v.selected)
                    .map(([id, v]) => {
                      const q = QUICK_ACCOUNTS.find((x) => x.id === id)!;
                      return (
                        <MoneyInput
                          key={id}
                          label={
                            q.type === 'credit'
                              ? `${q.label}: ¿cuánto debes hoy?`
                              : `${q.label}: saldo actual`
                          }
                          value={v.balance}
                          onChange={(b) =>
                            setAccounts((s) => ({ ...s, [id]: { selected: true, balance: b } }))
                          }
                        />
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}

        {current === 'try' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-ink">Pruébalo: anota algo</h1>
            <p className="text-muted">Escribe como hablas. Por ejemplo:</p>
            <div className="flex flex-wrap gap-2">
              {['galleta 30', 'uber 85', 'ayer tacos 120', '+15000 quincena'].map((ex) => (
                <Chip key={ex} onClick={() => setTryText(ex)}>
                  {ex}
                </Chip>
              ))}
            </div>
            <Input
              aria-label="Prueba aquí"
              value={tryText}
              onChange={(e) => setTryText(e.target.value)}
              placeholder="Escribe aquí…"
              autoFocus
            />
            {tryResult?.ok && (
              <div className="animate-pop">
                <EntryPreview entry={tryResult.entry} />
                <p className="mt-2 text-sm text-income">
                  ¿Viste? Entendí el monto, la categoría y la fecha. (Esto es solo una prueba, no se
                  guarda).
                </p>
              </div>
            )}
            {tryResult && !tryResult.ok && (
              <p className="text-sm text-amber-700">{tryResult.message}</p>
            )}
            <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">
              Después podrás anotar también por <b>WhatsApp</b> y con <b>tu voz</b>.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-2">
        {current === 'try' ? (
          <>
            <Button block size="lg" onClick={() => void finish(false)}>
              ¡Empezar!
            </Button>
            <Button block variant="ghost" onClick={() => void finish(true)}>
              Empezar con datos de ejemplo para explorar
            </Button>
          </>
        ) : (
          <Button block size="lg" onClick={next} disabled={current === 'name' && !name.trim()}>
            {current === 'welcome' ? 'Comenzar' : 'Continuar'}
          </Button>
        )}
      </div>
    </div>
  );
}

function LevelIcon({ level }: { level: Level }) {
  const Icon = LEVEL_ICONS[level];
  return <Icon className="h-5 w-5 text-accent-600" strokeWidth={1.75} aria-hidden />;
}
