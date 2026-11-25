import { Bug, CalendarDays } from 'lucide-react';
import { CatIcon, EmojiIcon } from '@/components/icons';
import { Link } from 'react-router';
import { ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import {
  BRAND,
  daysLeftInMonth,
  formatLongDate,
  formatMoney,
  formatMonthKey,
  isFeatureVisible,
  percent,
  topEntries,
  tripStatus,
  tripSummary,
} from '@fina/core';
import { useCategoryMap, useFinance } from '@/lib/finance';
import { useData, useDocs } from '@/stores/data';
import { useSession } from '@/stores/session';
import { useUI } from '@/stores/ui';
import { loadDemoData } from '@/lib/actions';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  IconButton,
  LinkButton,
  Money,
  ProgressBar,
  cx,
} from '@/components/ui';
import { QuickCaptureBar } from '@/features/capture/QuickCaptureBar';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { SpaceSwitcher } from '@/features/household/SpaceSwitcher';
import { useMissions } from '@/features/academy/missions';
import { CoupleCard } from '@/features/household/CoupleCard';
import { useInsights } from './insights';
import { useEffect } from 'react';
import { scheduleLocalReminders } from '@/lib/notifications';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function HomePage() {
  const f = useFinance();
  const profile = useData((s) => s.profile);
  const settings = useData((s) => s.settings);
  const updateSettings = useData((s) => s.updateSettings);
  const level = profile?.level ?? 'basic';
  const user = useSession((s) => s.user);
  const txs = useDocs('transactions');
  const catMap = useCategoryMap();
  const openCapture = useUI((s) => s.openCapture);
  const { next, progress } = useMissions();
  const insights = useInsights(f);
  const name = (profile?.name || user?.name || '').split(' ')[0];
  const organized = isFeatureVisible(level, 'budgets');
  // Android: reprograma los avisos locales (pagos de tarjeta, recurrentes) sin depender del servidor.
  useEffect(() => {
    void scheduleLocalReminders(f, settings.notifications.cardDueDaysBefore).catch(() => {});
  }, [f, settings.notifications.cardDueDaysBefore]);

  const recent = [...txs]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const top = topEntries(f.monthSummary.byCategory, 5);
  const topMax = top[0]?.[1] ?? 1;
  const diff = f.prevSamePoint.spentCents
    ? percent(f.spentToDate - f.prevSamePoint.spentCents, f.prevSamePoint.spentCents)
    : null;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pt-1">
        <div>
          <p className="text-sm text-muted">{formatLongDate(f.today)}</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
        <IconButton
          label={settings.privacyMode ? 'Mostrar montos' : 'Ocultar montos (modo discreto)'}
          onClick={() => void updateSettings({ privacyMode: !settings.privacyMode })}
        >
          {settings.privacyMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </IconButton>
      </header>

      <SpaceSwitcher />
      <QuickCaptureBar />

      {f.txCount === 0 ? (
        <Card className="bg-gradient-to-br from-accent-600 to-accent-800 text-white">
          <h2 className="text-xl font-bold">¡Bienvenido a {BRAND.appName}!</h2>
          <p className="mt-1 text-white/85">
            Escribe arriba tu primer gasto, por ejemplo <b>“galleta 30”</b>. Yo adivino la
            categoría, la cuenta y la fecha.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => openCapture('café 45')}>
              Probar con “café 45”
            </Button>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => void loadDemoData()}
            >
              Ver con datos de ejemplo
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="relative overflow-hidden">
          <p className="text-sm font-medium text-muted">
            {formatMonthKey(f.month)} · este mes llevas
          </p>
          <div className="mt-1 flex items-end gap-3">
            <Money
              cents={f.monthSummary.spentCents}
              className="text-4xl font-extrabold tracking-tight text-ink"
            />
            <span className="mb-1.5 text-sm text-muted">gastados</span>
          </div>
          {diff !== null && Math.abs(diff) >= 3 && (
            <p
              className={cx(
                'mt-1 text-sm font-medium',
                diff < 0 ? 'text-income' : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {diff < 0 ? '▼' : '▲'} {Math.abs(diff)} % {diff < 0 ? 'menos' : 'más'} que el mes
              pasado a esta fecha
            </p>
          )}
          {organized && f.budgetTotal > 0 && (
            <div className="mt-3">
              <ProgressBar
                value={percent(f.budgetSpent, f.budgetTotal)}
                status={
                  f.budgetSpent > f.budgetTotal
                    ? 'over'
                    : f.budgetSpent > f.budgetTotal * 0.8
                      ? 'warn'
                      : 'accent'
                }
                label="Presupuesto del mes"
              />
              <p className="mt-1.5 text-sm text-muted">
                <Money cents={f.budgetSpent} /> de <Money cents={f.budgetTotal} /> presupuestados ·
                quedan {daysLeftInMonth(f.today)} días
              </p>
            </div>
          )}
          {f.monthSummary.incomeCents > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-surface-2 p-2.5">
                <div className="text-xs text-muted">Te entró</div>
                <Money cents={f.monthSummary.incomeCents} kind="income" className="font-bold" />
              </div>
              <div className="rounded-xl bg-surface-2 p-2.5">
                <div className="text-xs text-muted">Balance del mes</div>
                <Money
                  cents={f.monthSummary.incomeCents - f.monthSummary.spentCents}
                  signed
                  className={cx(
                    'font-bold',
                    f.monthSummary.incomeCents >= f.monthSummary.spentCents
                      ? 'text-income'
                      : 'text-ink',
                  )}
                />
              </div>
            </div>
          )}
        </Card>
      )}

      {f.hasAccounts &&
        f.available > 0 &&
        f.nextPayday &&
        (organized || f.monthSummary.incomeCents > 0) && (
          <Card className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CalendarDays className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">
                Puedes gastar al día hasta tu pago del {Number(f.nextPayday.slice(8))}
              </p>
              <p className="text-2xl font-bold text-ink">
                <Money cents={f.safe.perDayCents} />
                <span className="text-base font-medium text-muted"> /día · {f.safe.days} días</span>
              </p>
              {f.committed > 0 && (
                <p className="text-xs text-muted">
                  Ya apartamos <Money cents={f.committed} /> para tus pagos pendientes.
                </p>
              )}
            </div>
          </Card>
        )}

      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.slice(0, 4).map((i) => (
            <Link
              key={i.id}
              to={i.to ?? '#'}
              className={cx(
                'flex items-center gap-3 rounded-2xl border p-3 transition hover:brightness-[0.98]',
                i.tone === 'bad'
                  ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
                  : i.tone === 'warn'
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                    : i.tone === 'good'
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                      : 'border-line bg-surface',
              )}
            >
              <EmojiIcon emoji={i.emoji} className="h-6 w-6 shrink-0 text-ink/70" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{i.title}</p>
                {i.text && <p className="text-sm text-muted">{i.text}</p>}
              </div>
              {i.to && <ArrowRight className="h-4 w-4 shrink-0 text-muted" />}
            </Link>
          ))}
        </div>
      )}

      <CoupleCard />

      {next && (
        <Card className="border-accent-200 bg-accent-50/60 dark:border-accent-900 dark:bg-accent-950/30">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-100 text-accent-700 dark:bg-accent-900/60 dark:text-accent-200">
              <EmojiIcon emoji={next.emoji} className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wide text-accent-700 uppercase dark:text-accent-300">
                Tu siguiente paso · {Math.round(progress * 100)} %
              </p>
              <p className="font-semibold text-ink">{next.title}</p>
              <p className="text-sm text-muted">{next.text}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={progress * 100} className="flex-1" label="Progreso de misiones" />
            {next.to.includes('capture') ? (
              <Button size="sm" onClick={() => openCapture()}>
                {next.cta}
              </Button>
            ) : (
              <LinkButton to={next.to} size="sm" variant="primary">
                {next.cta}
              </LinkButton>
            )}
          </div>
        </Card>
      )}

      <TripHomeCard />

      {(f.overdue.length > 0 || (organized && f.upcoming.length > 0)) && (
        <Card>
          <CardTitle
            action={
              <Link to="/pagos" className="text-sm font-semibold text-accent-600">
                Ver todos
              </Link>
            }
          >
            Próximos pagos
          </CardTitle>
          {f.overdue.length > 0 && (
            <Link
              to="/pagos"
              className="mb-2 block rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
            >
              Tienes {f.overdue.length} {f.overdue.length === 1 ? 'pago vencido' : 'pagos vencidos'}
              :{' '}
              {f.overdue
                .map((o) => o.title)
                .slice(0, 2)
                .join(', ')}
            </Link>
          )}
          <ul className="space-y-1">
            {f.upcoming.slice(0, 5).map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink/70">
                  <EmojiIcon emoji={u.emoji} className="h-[1.1rem] w-[1.1rem]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{u.title}</p>
                  <p className="text-sm text-muted">
                    {u.daysUntil === 0
                      ? 'Hoy'
                      : u.daysUntil === 1
                        ? 'Mañana'
                        : `En ${u.daysUntil} días · ${formatLongDate(u.date)}`}
                  </p>
                </div>
                <Money
                  cents={u.amountCents}
                  kind={u.direction === 'in' ? 'income' : 'neutral'}
                  className="font-semibold"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {top.length > 0 && (
        <Card>
          <CardTitle
            action={
              organized ? (
                <Link to="/reportes" className="text-sm font-semibold text-accent-600">
                  Reportes
                </Link>
              ) : undefined
            }
          >
            ¿En qué se te va?
          </CardTitle>
          <ul className="space-y-3">
            {top.map(([catId, amount]) => {
              const c = catMap.get(catId);
              return (
                <li key={catId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <CatIcon category={c} size="sm" /> {c?.name ?? 'Otros'}
                    </span>
                    <span className="text-muted">
                      <Money cents={amount} className="font-semibold text-ink" /> ·{' '}
                      {percent(amount, f.monthSummary.spentCents)} %
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(amount / topMax) * 100}%`,
                        background: c?.color ?? 'var(--a-500)',
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {f.ant.count >= 3 && (
        <Card className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            aria-hidden
          >
            <Bug className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">Tus gastos hormiga del mes</p>
            <p className="text-xl font-bold text-ink">
              <Money cents={f.ant.totalCents} />{' '}
              <span className="text-base font-medium text-muted">
                = {f.ant.equivalence.qty} {f.ant.equivalence.label}
              </span>
            </p>
            <p className="text-xs text-muted">
              {f.ant.count} compras de menos de $100.{' '}
              <Link className="font-semibold text-accent-600" to="/aprende/hormiga">
                ¿Cómo bajarlos?
              </Link>
            </p>
          </div>
        </Card>
      )}

      {recent.length > 0 && (
        <Card className="p-2">
          <CardTitle
            className="px-2 pt-2"
            action={
              <Link to="/movimientos" className="text-sm font-semibold text-accent-600">
                Ver todos
              </Link>
            }
          >
            Últimos movimientos
          </CardTitle>
          {recent.map((t) => (
            <TransactionRow key={t.id} tx={t} showDate />
          ))}
        </Card>
      )}

      {f.reviewCount > 0 && <Badge tone="warn">{f.reviewCount} por revisar</Badge>}

      <Link
        to="/asistente"
        className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-4 text-muted transition hover:border-accent-400 hover:text-ink"
      >
        <Sparkles className="h-5 w-5 text-accent-500" />
        <span className="flex-1">
          Pregúntale a {BRAND.assistantName}: “¿me alcanza para unos tenis de {formatMoney(180000)}
          ?”
        </span>
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

/** Viaje en curso o el próximo (dentro de 60 días) con lo esencial. */
function TripHomeCard() {
  const trips = useData((s) => s.data.trips);
  const transactions = useData((s) => s.data.transactions);
  const { today } = useFinance();
  const trip =
    trips.find((t) => !t.archived && tripStatus(t, today) === 'active') ??
    trips
      .filter((t) => !t.archived && tripStatus(t, today) === 'planning')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (!trip) return null;
  const s = tripSummary(trip, transactions, today);
  if (s.status === 'planning' && s.daysUntil > 60) return null;
  return (
    <Link to={`/viajes/${trip.id}`} className="block">
      <Card className="flex items-center gap-3 transition hover:border-accent-300">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-200">
          <EmojiIcon emoji={trip.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{trip.name}</p>
          <p className="text-sm text-muted">
            {s.status === 'active' ? (
              <>
                Día {s.dayNumber} de {s.days} · hoy puedes gastar{' '}
                <Money cents={s.canSpendPerDayCents ?? 0} className="font-semibold text-ink" />
              </>
            ) : (
              <>
                {s.daysUntil === 1 ? 'Sales mañana' : `Faltan ${s.daysUntil} días`}
                {s.budgetCents > 0 && (
                  <>
                    {' '}
                    · presupuesto <Money cents={s.budgetCents} />
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <ArrowRight className="h-5 w-5 text-muted" />
      </Card>
    </Link>
  );
}
