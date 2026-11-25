import { Plane } from 'lucide-react';
import { IconTile, iconFromValue } from '@/components/icons';

/** Ícono de un viaje (línea sencilla con el tinte del color de acento). */
export function TripIcon({ value, size = 'lg' }: { value: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <IconTile
      icon={iconFromValue(value) ?? Plane}
      size={size}
      className="bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-200"
    />
  );
}
