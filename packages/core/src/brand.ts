/**
 * Marca de la app. TODO el texto de marca sale de aquí: para renombrar la app o
 * cambiar sus colores basta con editar este archivo (y volver a desplegar).
 */
export const BRAND = {
  appName: 'Fina',
  slogan: 'Anota en 3 segundos. Entiende tu dinero para siempre.',
  description:
    'Finanzas personales hechas para México: anota tus gastos escribiendo "tacos 120" en la app o por WhatsApp, y lleva presupuestos, tarjetas, MSI, metas y finanzas en pareja.',
  assistantName: 'Fina',
  /** Paleta por defecto (ver ACCENT_PALETTES). */
  defaultAccent: 'indigo' as AccentName,
  /** Color de fondo de la barra del sistema / ícono (hex). */
  themeColor: '#4f46e5',
  backgroundColor: '#f8f8fa',
  locale: 'es-MX',
  currency: 'MXN',
  timezone: 'America/Mexico_City',
} as const;

export const APP_NAME = BRAND.appName;

export type AccentName = 'indigo' | 'violet' | 'blue' | 'emerald';

type Shades = Record<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950', string>;

/** Paletas de acento. Neutros fríos + un solo color de acento. */
export const ACCENT_PALETTES: Record<AccentName, { label: string; shades: Shades }> = {
  indigo: {
    label: 'Índigo',
    shades: {
      '50': '#eef2ff',
      '100': '#e0e7ff',
      '200': '#c7d2fe',
      '300': '#a5b4fc',
      '400': '#818cf8',
      '500': '#6366f1',
      '600': '#4f46e5',
      '700': '#4338ca',
      '800': '#3730a3',
      '900': '#312e81',
      '950': '#1e1b4b',
    },
  },
  violet: {
    label: 'Morado',
    shades: {
      '50': '#f5f3ff',
      '100': '#ede9fe',
      '200': '#ddd6fe',
      '300': '#c4b5fd',
      '400': '#a78bfa',
      '500': '#8b5cf6',
      '600': '#7c3aed',
      '700': '#6d28d9',
      '800': '#5b21b6',
      '900': '#4c1d95',
      '950': '#2e1065',
    },
  },
  blue: {
    label: 'Azul',
    shades: {
      '50': '#eff6ff',
      '100': '#dbeafe',
      '200': '#bfdbfe',
      '300': '#93c5fd',
      '400': '#60a5fa',
      '500': '#3b82f6',
      '600': '#2563eb',
      '700': '#1d4ed8',
      '800': '#1e40af',
      '900': '#1e3a8a',
      '950': '#172554',
    },
  },
  emerald: {
    label: 'Esmeralda',
    shades: {
      '50': '#ecfdf5',
      '100': '#d1fae5',
      '200': '#a7f3d0',
      '300': '#6ee7b7',
      '400': '#34d399',
      '500': '#10b981',
      '600': '#059669',
      '700': '#047857',
      '800': '#065f46',
      '900': '#064e3b',
      '950': '#022c22',
    },
  },
};
