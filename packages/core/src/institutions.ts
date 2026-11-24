import type { AccountType } from './schemas';

export interface Institution {
  id: string;
  name: string;
  /** Formas en que la gente lo escribe (sin acentos, minúsculas). */
  aliases: string[];
  color: string;
  /** Tipo de cuenta más común con esa institución. */
  defaultType: AccountType;
  kind: 'bank' | 'fintech' | 'wallet' | 'voucher' | 'cash' | 'retail';
}

/** Bancos, fintechs y monederos más usados en México. */
export const INSTITUTIONS: Institution[] = [
  { id: 'cash', name: 'Efectivo', aliases: ['efectivo', 'cash', 'cartera', 'billetera', 'en mano', 'feria'], color: '#16a34a', defaultType: 'cash', kind: 'cash' },
  { id: 'bbva', name: 'BBVA', aliases: ['bbva', 'bancomer', 'bbva bancomer'], color: '#072146', defaultType: 'debit', kind: 'bank' },
  { id: 'banamex', name: 'Banamex', aliases: ['banamex', 'citibanamex', 'citi'], color: '#056dae', defaultType: 'debit', kind: 'bank' },
  { id: 'santander', name: 'Santander', aliases: ['santander'], color: '#ec0000', defaultType: 'debit', kind: 'bank' },
  { id: 'banorte', name: 'Banorte', aliases: ['banorte'], color: '#eb0029', defaultType: 'debit', kind: 'bank' },
  { id: 'hsbc', name: 'HSBC', aliases: ['hsbc'], color: '#db0011', defaultType: 'debit', kind: 'bank' },
  { id: 'scotiabank', name: 'Scotiabank', aliases: ['scotiabank', 'scotia'], color: '#ec111a', defaultType: 'debit', kind: 'bank' },
  { id: 'inbursa', name: 'Inbursa', aliases: ['inbursa'], color: '#003b71', defaultType: 'debit', kind: 'bank' },
  { id: 'azteca', name: 'Banco Azteca', aliases: ['azteca', 'banco azteca', 'elektra'], color: '#0d7a3b', defaultType: 'debit', kind: 'bank' },
  { id: 'bancoppel', name: 'BanCoppel', aliases: ['bancoppel', 'coppel'], color: '#ffd200', defaultType: 'debit', kind: 'bank' },
  { id: 'afirme', name: 'Afirme', aliases: ['afirme'], color: '#00a14b', defaultType: 'debit', kind: 'bank' },
  { id: 'banregio', name: 'Banregio', aliases: ['banregio'], color: '#ff6b00', defaultType: 'debit', kind: 'bank' },
  { id: 'bancodelbienestar', name: 'Banco del Bienestar', aliases: ['bienestar', 'banco del bienestar'], color: '#9d2449', defaultType: 'debit', kind: 'bank' },
  { id: 'hey', name: 'Hey Banco', aliases: ['hey', 'hey banco'], color: '#111111', defaultType: 'debit', kind: 'fintech' },
  { id: 'nu', name: 'Nu', aliases: ['nu', 'nubank', 'nu mexico', 'tarjeta nu', 'la morada'], color: '#820ad1', defaultType: 'credit', kind: 'fintech' },
  { id: 'mercadopago', name: 'Mercado Pago', aliases: ['mercado pago', 'mercadopago', 'mp'], color: '#00b1ea', defaultType: 'wallet', kind: 'wallet' },
  { id: 'spin', name: 'Spin by OXXO', aliases: ['spin', 'spin by oxxo', 'spin oxxo'], color: '#e4002b', defaultType: 'wallet', kind: 'wallet' },
  { id: 'klar', name: 'Klar', aliases: ['klar'], color: '#1f1f1f', defaultType: 'debit', kind: 'fintech' },
  { id: 'stori', name: 'Stori', aliases: ['stori'], color: '#00b0a6', defaultType: 'credit', kind: 'fintech' },
  { id: 'rappicard', name: 'RappiCard', aliases: ['rappicard', 'rappi card'], color: '#ff441f', defaultType: 'credit', kind: 'fintech' },
  { id: 'didicard', name: 'DiDi Card', aliases: ['didi card', 'didicard'], color: '#fc4c02', defaultType: 'credit', kind: 'fintech' },
  { id: 'plata', name: 'Plata Card', aliases: ['plata', 'plata card'], color: '#999999', defaultType: 'credit', kind: 'fintech' },
  { id: 'vexi', name: 'Vexi', aliases: ['vexi'], color: '#ff6a13', defaultType: 'credit', kind: 'fintech' },
  { id: 'cetesdirecto', name: 'Cetesdirecto', aliases: ['cetesdirecto', 'cetes directo'], color: '#1f4e79', defaultType: 'investment', kind: 'fintech' },
  { id: 'gbm', name: 'GBM', aliases: ['gbm', 'gbm+'], color: '#00205b', defaultType: 'investment', kind: 'fintech' },
  { id: 'paypal', name: 'PayPal', aliases: ['paypal'], color: '#003087', defaultType: 'wallet', kind: 'wallet' },
  { id: 'edenred', name: 'Vales Edenred', aliases: ['edenred', 'vales', 'vales de despensa', 'ticket car'], color: '#e4032e', defaultType: 'voucher', kind: 'voucher' },
  { id: 'sivale', name: 'Sí Vale', aliases: ['si vale', 'sivale'], color: '#e30613', defaultType: 'voucher', kind: 'voucher' },
  { id: 'liverpool', name: 'Liverpool', aliases: ['liverpool'], color: '#e10098', defaultType: 'credit', kind: 'retail' },
  { id: 'amex', name: 'American Express', aliases: ['amex', 'american express'], color: '#2e77bb', defaultType: 'credit', kind: 'bank' },
];

export const INSTITUTION_MAP: Record<string, Institution> = Object.fromEntries(INSTITUTIONS.map((i) => [i.id, i]));

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Tarjeta de crédito',
  savings: 'Ahorro',
  investment: 'Inversión',
  wallet: 'Monedero digital',
  voucher: 'Vales',
  loan: 'Crédito / préstamo',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  cash: '💵',
  debit: '💳',
  credit: '💳',
  savings: '🐷',
  investment: '📈',
  wallet: '📱',
  voucher: '🎟️',
  loan: '🏦',
};

/** Cuentas de pasivo (su saldo representa lo que debes). */
export const LIABILITY_TYPES = new Set<AccountType>(['credit', 'loan']);
/** Cuentas de dinero disponible para gastar. */
export const LIQUID_TYPES = new Set<AccountType>(['cash', 'debit', 'wallet', 'voucher']);
