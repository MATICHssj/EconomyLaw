import { Link } from 'react-router';
import { FEATURES, LEVEL_INFO, isFeatureVisible, type FeatureId, type Level } from '@fina/core';
import { useData } from '@/stores/data';
import { useSession } from '@/stores/session';
import { Card, LinkButton, PageHeader } from '@/components/ui';
import { useMissions } from '@/features/academy/missions';

interface Tile {
  to: string;
  emoji: string;
  label: string;
  feature?: FeatureId;
}

const SECTIONS: Array<{ title: string; tiles: Tile[] }> = [
  {
    title: 'Tu dinero',
    tiles: [
      { to: '/cuentas', emoji: '🏦', label: 'Cuentas', feature: 'accounts' },
      { to: '/tarjetas', emoji: '💳', label: 'Tarjetas y MSI', feature: 'creditCards' },
      { to: '/presupuesto', emoji: '🐷', label: 'Presupuesto', feature: 'budgets' },
      { to: '/recurrentes', emoji: '🔁', label: 'Recurrentes y suscripciones', feature: 'recurring' },
      { to: '/metas', emoji: '🎯', label: 'Metas de ahorro', feature: 'goals' },
      { to: '/reportes', emoji: '📊', label: 'Reportes', feature: 'reports' },
      { to: '/calendario', emoji: '🗓️', label: 'Calendario de pagos', feature: 'calendar' },
      { to: '/salud', emoji: '❤️', label: 'Salud financiera', feature: 'health' },
    ],
  },
  {
    title: 'Control total',
    tiles: [
      { to: '/deudas', emoji: '⛓️', label: 'Salir de deudas', feature: 'debts' },
      { to: '/personas', emoji: '🤝', label: 'Préstamos y compartidos', feature: 'loans' },
      { to: '/tandas', emoji: '🫙', label: 'Tandas', feature: 'tandas' },
      { to: '/inversiones', emoji: '📈', label: 'Inversiones', feature: 'investments' },
      { to: '/patrimonio', emoji: '🏛️', label: 'Patrimonio', feature: 'netWorth' },
      { to: '/proyeccion', emoji: '🔮', label: 'Proyección', feature: 'projection' },
      { to: '/sat', emoji: '🧾', label: 'SAT y deducibles', feature: 'sat' },
      { to: '/reglas', emoji: '⚙️', label: 'Reglas automáticas', feature: 'rules' },
    ],
  },
  {
    title: 'Conecta',
    tiles: [
      { to: '/whatsapp', emoji: '💬', label: 'WhatsApp', feature: 'whatsapp' },
      { to: '/hogar', emoji: '💑', label: 'Pareja / familia', feature: 'household' },
      { to: '/importar', emoji: '📥', label: 'Importar estado de cuenta', feature: 'import' },
      { to: '/asistente', emoji: '✨', label: 'Pregúntale a Fina', feature: 'assistant' },
    ],
  },
  {
    title: 'Aprende y configura',
    tiles: [
      { to: '/aprende', emoji: '🎓', label: 'Aprende', feature: 'academy' },
      { to: '/categorias', emoji: '🏷️', label: 'Categorías', feature: 'customCategories' },
      { to: '/ajustes', emoji: '⚙️', label: 'Ajustes' },
      { to: '/instalar', emoji: '📲', label: 'Instalar la app' },
    ],
  },
];

export default function MorePage() {
  const level: Level = useData((s) => s.profile?.level ?? 'basic');
  const user = useSession((s) => s.user);
  const mode = useSession((s) => s.mode);
  const { progress } = useMissions();
  const hidden = (Object.keys(FEATURES) as FeatureId[]).filter((f) => !isFeatureVisible(level, f)).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Más" />
      <Card className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-xl font-bold text-accent-700 dark:bg-accent-900 dark:text-accent-100">
          {user?.photoURL ? <img src={user.photoURL} alt="" className="h-12 w-12 rounded-full" /> : LEVEL_INFO[level].emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{mode === 'local' ? 'Modo sin cuenta' : user?.email}</p>
          <p className="text-sm text-muted">
            Nivel {LEVEL_INFO[level].label} · {Math.round(progress * 100)} % de misiones
          </p>
        </div>
        <LinkButton to="/ajustes" size="sm">
          Ajustes
        </LinkButton>
      </Card>
      {SECTIONS.map((sec) => {
        const tiles = sec.tiles.filter((t) => !t.feature || isFeatureVisible(level, t.feature));
        if (!tiles.length) return null;
        return (
          <section key={sec.title}>
            <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-muted uppercase">{sec.title}</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {tiles.map((t) => (
                <Link key={t.to} to={t.to} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface p-3 text-center transition hover:border-accent-300 hover:bg-surface-2">
                  <span className="text-3xl" aria-hidden>
                    {t.emoji}
                  </span>
                  <span className="text-xs leading-tight font-medium text-ink">{t.label}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {hidden > 0 && (
        <Card className="border-dashed text-center">
          <p className="font-semibold text-ink">🌱 Hay {hidden} funciones más esperándote</p>
          <p className="mt-1 text-sm text-muted">Presupuestos, tarjetas con fecha de corte, MSI, deudas, tandas, inversiones… Sube de nivel cuando quieras; no pierdes nada.</p>
          <LinkButton to="/ajustes#nivel" variant="soft" className="mt-3">
            Cambiar de nivel
          </LinkButton>
        </Card>
      )}
    </div>
  );
}
