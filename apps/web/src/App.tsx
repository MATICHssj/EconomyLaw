import { lazy, Suspense, useEffect } from 'react';
import { createHashRouter, Navigate, Outlet, RouterProvider } from 'react-router';
import { useSession } from '@/stores/session';
import { useData } from '@/stores/data';
import { useUI } from '@/stores/ui';
import { useThemeEffect } from '@/lib/theme';
import { processDueRecurring, refreshFxRates } from '@/lib/actions';
import { importPendingBankNotifications, listenBankNotifications } from '@/lib/bankNotifications';
import { isCapacitor } from '@/lib/pwa';
import { Layout } from '@/components/Layout';
import { ConfirmHost, Toasts } from '@/components/ui';
import { Splash } from '@/components/Splash';
import { IosInstallHint } from '@/components/IosInstallHint';
import { notifyIfUpdate } from '@/lib/updates';
import { CaptureSheet } from '@/features/capture/CaptureSheet';
import { EditTransactionSheet } from '@/features/transactions/EditTransactionSheet';
import { LockScreen, useAutoLock } from '@/features/security/LockScreen';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { HomePage } from '@/features/home/HomePage';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';

const BudgetPage = lazy(() => import('@/features/budget/BudgetPage'));
const MorePage = lazy(() => import('@/pages/MorePage'));
const AccountsPage = lazy(() => import('@/features/accounts/AccountsPage'));
const AccountDetailPage = lazy(() => import('@/features/accounts/AccountDetailPage'));
const CardsPage = lazy(() => import('@/features/accounts/CardsPage'));
const RecurringPage = lazy(() => import('@/features/recurring/RecurringPage'));
const GoalsPage = lazy(() => import('@/features/goals/GoalsPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const CalendarPage = lazy(() => import('@/features/reports/CalendarPage'));
const ImportPage = lazy(() => import('@/features/import/ImportPage'));
const CategoriesPage = lazy(() => import('@/features/settings/CategoriesPage'));
const RulesPage = lazy(() => import('@/features/settings/RulesPage'));
const DebtsPage = lazy(() => import('@/features/expert/DebtsPage'));
const PeoplePage = lazy(() => import('@/features/expert/PeoplePage'));
const TandasPage = lazy(() => import('@/features/expert/TandasPage'));
const InvestmentsPage = lazy(() => import('@/features/expert/InvestmentsPage'));
const NetWorthPage = lazy(() => import('@/features/expert/NetWorthPage'));
const ProjectionPage = lazy(() => import('@/features/expert/ProjectionPage'));
const SatPage = lazy(() => import('@/features/expert/SatPage'));
const HouseholdPage = lazy(() => import('@/features/household/HouseholdPage'));
const WhatsAppPage = lazy(() => import('@/features/whatsapp/WhatsAppPage'));
const AssistantPage = lazy(() => import('@/features/assistant/AssistantPage'));
const AcademyPage = lazy(() => import('@/features/academy/AcademyPage'));
const LessonPage = lazy(() => import('@/features/academy/LessonPage'));
const HealthPage = lazy(() => import('@/features/health/HealthPage'));
const TripsPage = lazy(() => import('@/features/trips/TripsPage'));
const TripDetailPage = lazy(() => import('@/features/trips/TripDetailPage'));
const PaymentsPage = lazy(() => import('@/features/payments/PaymentsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const InstallPage = lazy(() => import('@/pages/InstallPage'));
const LegalPage = lazy(() => import('@/pages/LegalPage'));

function Shell() {
  return (
    <Layout>
      <Suspense fallback={<div className="py-20 text-center text-muted">Cargando…</div>}>
        <Outlet />
      </Suspense>
      <CaptureSheet />
      <EditTransactionSheet />
    </Layout>
  );
}

const router = createHashRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/movimientos', element: <TransactionsPage /> },
      { path: '/presupuesto', element: <BudgetPage /> },
      { path: '/mas', element: <MorePage /> },
      { path: '/cuentas', element: <AccountsPage /> },
      { path: '/cuentas/:id', element: <AccountDetailPage /> },
      { path: '/tarjetas', element: <CardsPage /> },
      { path: '/recurrentes', element: <RecurringPage /> },
      { path: '/metas', element: <GoalsPage /> },
      { path: '/reportes', element: <ReportsPage /> },
      { path: '/calendario', element: <CalendarPage /> },
      { path: '/importar', element: <ImportPage /> },
      { path: '/categorias', element: <CategoriesPage /> },
      { path: '/reglas', element: <RulesPage /> },
      { path: '/deudas', element: <DebtsPage /> },
      { path: '/personas', element: <PeoplePage /> },
      { path: '/tandas', element: <TandasPage /> },
      { path: '/inversiones', element: <InvestmentsPage /> },
      { path: '/patrimonio', element: <NetWorthPage /> },
      { path: '/proyeccion', element: <ProjectionPage /> },
      { path: '/sat', element: <SatPage /> },
      { path: '/hogar', element: <HouseholdPage /> },
      { path: '/whatsapp', element: <WhatsAppPage /> },
      { path: '/asistente', element: <AssistantPage /> },
      { path: '/aprende', element: <AcademyPage /> },
      { path: '/aprende/:id', element: <LessonPage /> },
      { path: '/salud', element: <HealthPage /> },
      { path: '/viajes', element: <TripsPage /> },
      { path: '/viajes/:id', element: <TripDetailPage /> },
      { path: '/pagos', element: <PaymentsPage /> },
      { path: '/ajustes', element: <SettingsPage /> },
      { path: '/instalar', element: <InstallPage /> },
      { path: '/privacidad', element: <LegalPage doc="privacy" /> },
      { path: '/terminos', element: <LegalPage doc="terms" /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

/** Texto compartido desde otra app (Web Share Target) o atajos: ?text=… / ?capture=1 */
function useLaunchParams() {
  const ready = useData((s) => s.ready);
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(location.search || location.hash.split('?')[1] || '');
    const text = [params.get('title'), params.get('text')].filter(Boolean).join(' ').trim();
    if (text || params.get('capture')) {
      useUI.getState().openCapture(text);
      history.replaceState(null, '', location.pathname + location.hash.split('?')[0]);
    }
  }, [ready]);
}

export function App() {
  const status = useSession((s) => s.status);
  const ready = useData((s) => s.ready);
  const profile = useData((s) => s.profile);
  const locked = useUI((s) => s.locked);
  useThemeEffect();
  useAutoLock();
  useLaunchParams();

  useEffect(() => {
    useSession.getState().init();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void refreshFxRates();
    void processDueRecurring();
    if (!isCapacitor()) return;
    void notifyIfUpdate();
    // Android: movimientos de las notificaciones del banco y avisos locales.
    void importPendingBankNotifications().catch(() => {});
    let stop: (() => void) | undefined;
    void listenBankNotifications().then((s) => (stop = s));
    const onResume = () =>
      document.visibilityState === 'visible' &&
      void importPendingBankNotifications().catch(() => {});
    document.addEventListener('visibilitychange', onResume);
    return () => {
      stop?.();
      document.removeEventListener('visibilitychange', onResume);
    };
  }, [ready]);

  let content;
  if (status === 'loading') content = <Splash />;
  else if (status === 'signedOut') content = <AuthScreen />;
  else if (!ready) content = <Splash />;
  else if (!profile?.onboarded) content = <Onboarding />;
  else if (locked) content = <LockScreen />;
  else content = <RouterProvider router={router} />;

  return (
    <>
      {content}
      <Toasts />
      <IosInstallHint />
      <ConfirmHost />
    </>
  );
}
