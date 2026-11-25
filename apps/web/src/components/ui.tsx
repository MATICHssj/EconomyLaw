import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatMoney } from '@fina/core';
import { useData } from '@/stores/data';
import { useUI } from '@/stores/ui';

export function cx(...c: Array<string | false | null | undefined>): string {
  return c.filter(Boolean).join(' ');
}

// ——————————————————— Botones ———————————————————

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
const btnBase =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700 shadow-sm shadow-accent-600/20',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  soft: 'bg-accent-50 text-accent-700 hover:bg-accent-100 dark:bg-accent-950/60 dark:text-accent-200 dark:hover:bg-accent-900/60',
};
const btnSizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[0.95rem]',
  lg: 'h-13 px-5 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: keyof typeof btnSizes;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(btnBase, btnVariants[variant], btnSizes[size], block && 'w-full', className)}
      {...rest}
    />
  );
});

export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  className,
  children,
}: {
  to: string;
  variant?: BtnVariant;
  size?: keyof typeof btnSizes;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cx(btnBase, btnVariants[variant], btnSizes[size], className)}>
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-500',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ——————————————————— Superficies ———————————————————

export function Card({
  className,
  children,
  as: As = 'section',
  ...rest
}: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' } & Record<
  string,
  unknown
>) {
  return (
    <As
      className={cx(
        'rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(16,16,30,0.04)]',
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

export function CardTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('mb-3 flex items-center justify-between gap-2', className)}>
      <h2 className="text-[0.95rem] font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: boolean | string;
  actions?: ReactNode;
}) {
  const nav = useNavigate();
  return (
    <header className="mb-4 flex items-start gap-2 pt-2">
      {back && (
        <IconButton
          label="Regresar"
          onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}
          className="-ml-2 mt-0.5"
        >
          <ChevronLeft className="h-6 w-6" />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

// ——————————————————— Dinero ———————————————————

/** Muestra un monto. En modo discreto se ocultan los números. */
export function Money({
  cents,
  currency,
  signed,
  className,
  kind,
  compact,
}: {
  cents: number;
  currency?: string;
  signed?: boolean;
  className?: string;
  kind?: 'income' | 'expense' | 'neutral';
  compact?: boolean;
}) {
  const privacy = useData((s) => s.settings.privacyMode);
  const peek = useUI((s) => s.privacyPeek);
  const hidden = privacy && !peek;
  const text = hidden
    ? '$ ••••'
    : formatMoney(kind === 'expense' ? -Math.abs(cents) : cents, {
        currency,
        signed: signed || kind === 'income',
        compact,
      });
  return (
    <span
      className={cx('tabular-nums', kind === 'income' && 'text-income', className)}
      aria-label={hidden ? 'Monto oculto' : undefined}
    >
      {text}
    </span>
  );
}

// ——————————————————— Progreso ———————————————————

export function ProgressBar({
  value,
  status,
  className,
  label,
}: {
  value: number;
  status?: 'ok' | 'warn' | 'over' | 'empty' | 'accent';
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    status === 'over'
      ? 'bg-rose-500'
      : status === 'warn'
        ? 'bg-amber-500'
        : status === 'ok'
          ? 'bg-emerald-500'
          : 'bg-accent-500';
  return (
    <div
      className={cx('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-500', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ——————————————————— Formularios ———————————————————

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-muted/70 outline-none transition focus:border-accent-500 focus:ring-4 focus:ring-accent-500/15';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode }
>(function Input({ label, hint, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const el = <input ref={ref} id={inputId} className={cx(inputCls, className)} {...rest} />;
  return label ? (
    <Field label={label} hint={hint} htmlFor={inputId}>
      {el}
    </Field>
  ) : (
    el
  );
});

export function Select({
  label,
  hint,
  options,
  className,
  id,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: ReactNode;
  options: Array<{ value: string; label: string }>;
}) {
  const autoId = useId();
  const selId = id ?? autoId;
  const el = (
    <select
      id={selId}
      className={cx(
        inputCls,
        'appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%2394a3b8' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  return label ? (
    <Field label={label} hint={hint} htmlFor={selId}>
      {el}
    </Field>
  ) : (
    el
  );
}

/** Campo de dinero: el usuario escribe pesos ("1,250.50"), guardamos centavos. */
export function MoneyInput({
  label,
  value,
  onChange,
  hint,
  autoFocus,
  id,
}: {
  label: string;
  value: number;
  onChange: (cents: number) => void;
  hint?: ReactNode;
  autoFocus?: boolean;
  id?: string;
}) {
  const [text, setText] = useState(value ? String(value / 100) : '');
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value ? String(value / 100) : '');
      last.current = value;
    }
  }, [value]);
  return (
    <Input
      id={id}
      label={label}
      hint={hint}
      inputMode="decimal"
      autoFocus={autoFocus}
      placeholder="$0"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '');
        setText(t);
        const n = Number(t.replace(/,/g, ''));
        const cents = Number.isFinite(n) ? Math.round(n * 100) : 0;
        last.current = cents;
        onChange(cents);
      }}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[0.95rem] font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
          checked ? 'bg-accent-600' : 'bg-line',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all',
            checked ? 'left-[1.375rem]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('flex rounded-xl bg-surface-2 p-1', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition',
        active
          ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-200'
          : 'border-line bg-surface text-ink hover:bg-surface-2',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent';
}) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    warn: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    bad: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    accent: 'bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

// ——————————————————— Listas ———————————————————

export function ListItem({
  icon,
  title,
  subtitle,
  right,
  onClick,
  to,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  to?: string;
  className?: string;
}) {
  const content = (
    <>
      {icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate font-medium text-ink">{title}</div>
        {subtitle && <div className="truncate text-sm text-muted">{subtitle}</div>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
      {(to || onClick) && !right && <ChevronRight className="h-4 w-4 shrink-0 text-muted" />}
    </>
  );
  const cls = cx(
    'flex w-full items-center gap-3 rounded-xl px-2 py-2.5 transition',
    (to || onClick) && 'hover:bg-surface-2',
    className,
  );
  if (to)
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {content}
      </button>
    );
  return <div className={cls}>{content}</div>;
}

export function EmptyState({
  emoji,
  title,
  text,
  action,
}: {
  emoji: string;
  title: string;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 text-5xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('rounded-2xl bg-surface-2 p-3', className)}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-ink">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

// ——————————————————— Hoja inferior / diálogo ———————————————————

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>(
        '[autofocus], input, select, textarea, button:not([data-close])',
      );
      el?.focus();
    }, 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <div
        className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            {title}
          </h2>
          <IconButton label="Cerrar" onClick={onClose} data-close>
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmación simple con promesa: await confirmDialog('¿Borrar?') */
let confirmResolver: ((v: boolean) => void) | null = null;
export function ConfirmHost() {
  const [state, setState] = useState<{
    title: string;
    text?: string;
    danger?: boolean;
    ok?: string;
  } | null>(null);
  useEffect(() => {
    (window as unknown as { __finaConfirm: typeof setState }).__finaConfirm = setState;
  }, []);
  const close = (v: boolean) => {
    confirmResolver?.(v);
    confirmResolver = null;
    setState(null);
  };
  return (
    <Sheet
      open={!!state}
      onClose={() => close(false)}
      title={state?.title ?? ''}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" block onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} block onClick={() => close(true)}>
            {state?.ok ?? 'Aceptar'}
          </Button>
        </div>
      }
    >
      {state?.text && <p className="text-muted">{state.text}</p>}
    </Sheet>
  );
}

export function confirmDialog(
  title: string,
  opts: { text?: string; danger?: boolean; ok?: string } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    (window as unknown as { __finaConfirm?: (s: unknown) => void }).__finaConfirm?.({
      title,
      ...opts,
    });
  });
}

// ——————————————————— Avisos ———————————————————

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'animate-toast pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl',
            t.tone === 'error' ? 'bg-rose-600 text-white' : 'bg-ink text-bg',
          )}
          role="status"
        >
          <span className="flex-1">{t.text}</span>
          {t.actions?.map((a) => (
            <button
              key={a.label}
              type="button"
              className="rounded-lg px-2 py-1 font-bold text-accent-300 hover:bg-white/10"
              onClick={() => {
                a.onClick();
                dismiss(t.id);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Tip({
  children,
  emoji = '💡',
  className,
}: {
  children: ReactNode;
  emoji?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex gap-3 rounded-2xl bg-accent-50 p-3 text-sm text-accent-900 dark:bg-accent-950/50 dark:text-accent-100',
        className,
      )}
    >
      <span aria-hidden className="text-lg leading-5">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
