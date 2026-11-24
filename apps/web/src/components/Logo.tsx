import { APP_NAME } from '@fina/core';
import { cx } from './ui';

/** Marca: una "f" que también es una hoja que crece (tu dinero creciendo contigo). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cx('h-9 w-9', className)} aria-hidden>
      <defs>
        <linearGradient id="fina-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--a-500)" />
          <stop offset="1" stopColor="var(--a-700)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#fina-g)" />
      <path d="M38.5 14c-6.6 0-10.5 3.9-10.5 10.4V28h-5v6h5v16h7V34h7v-6h-7v-3.2c0-2.6 1.3-4 3.8-4H43V14.3c-1.3-.2-2.8-.3-4.5-.3Z" fill="#fff" />
      <circle cx="46" cy="44" r="5" fill="#fff" opacity=".9" />
    </svg>
  );
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className={size === 'lg' ? 'h-14 w-14' : 'h-9 w-9'} />
      <span className={cx('font-bold tracking-tight text-ink', size === 'lg' ? 'text-4xl' : 'text-xl')}>{APP_NAME}</span>
    </div>
  );
}
