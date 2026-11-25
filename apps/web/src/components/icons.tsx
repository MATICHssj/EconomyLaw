import {
  BedDouble,
  Building2,
  Globe,
  Luggage,
  Nfc,
  StickyNote,
  Tent,
  ArrowDownToLine,
  Brain,
  CircleAlert,
  Cloud,
  Crown,
  Eraser,
  FlaskConical,
  Gauge,
  Hand,
  Handshake,
  Lock,
  Map as MapIcon,
  Mic,
  Moon,
  Mountain,
  PartyPopper,
  PenLine,
  Plus,
  Search,
  Shield,
  Snowflake,
  Sun,
  Trophy,
  Wrench,
  Camera,
  Bird,
  Bus,
  Stethoscope,
  Smile,
  Meh,
  Siren,
  ArrowLeftRight,
  Baby,
  Banknote,
  Bell,
  Beer,
  Bike,
  BookOpen,
  Briefcase,
  Bug,
  CalendarClock,
  CalendarDays,
  Car,
  CarTaxiFront,
  ChartColumn,
  ChartLine,
  ChartPie,
  CircleCheck,
  CircleDollarSign,
  CircleHelp,
  Clapperboard,
  Coffee,
  Coins,
  Cookie,
  CreditCard,
  Dumbbell,
  Flame,
  Fuel,
  Gem,
  Gift,
  GraduationCap,
  HandCoins,
  HandHeart,
  Heart,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  MessageCircle,
  Package,
  Palmtree,
  PawPrint,
  Percent,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Repeat,
  Scale,
  Scissors,
  Settings,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sofa,
  Sparkles,
  Sprout,
  Tag,
  Target,
  Ticket,
  TrendingUp,
  TriangleAlert,
  Tv,
  Undo2,
  Unlink,
  Upload,
  User,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Account, Category, Level, Transaction } from '@fina/core';
import { useData } from '@/stores/data';
import { cx } from './ui';

/**
 * Íconos de línea, sencillos y de un solo color (en lugar de emojis).
 * En Ajustes → Apariencia se puede volver a los emojis.
 */
export const ICONS = {
  // Categorías por defecto (mismo id que en @fina/core)
  groceries: ShoppingCart,
  housing: House,
  utilities: Lightbulb,
  transport: CarTaxiFront,
  gas: Fuel,
  car: Car,
  health: Pill,
  education: GraduationCap,
  kids: Baby,
  pets: PawPrint,
  debt_costs: Percent,
  taxes: Receipt,
  food: UtensilsCrossed,
  snacks: Cookie,
  coffee: Coffee,
  delivery: Bike,
  subscriptions: Tv,
  shopping: ShoppingBag,
  clothing: Shirt,
  home: Sofa,
  entertainment: Clapperboard,
  travel: Plane,
  personal_care: Scissors,
  sports: Dumbbell,
  gifts: Gift,
  alcohol: Beer,
  donations: HandHeart,
  business: Briefcase,
  savings: PiggyBank,
  investments: TrendingUp,
  debt_extra: Unlink,
  other: Package,
  review: CircleHelp,
  adjustment: Scale,
  salary: Wallet,
  bonus: Sparkles,
  freelance: Laptop,
  sales: Tag,
  returns: ChartLine,
  refunds: Undo2,
  gifts_received: Gift,
  tanda_payout: Coins,
  other_income: CircleDollarSign,
  // Genéricos
  cash: Banknote,
  card: CreditCard,
  wallet: Wallet,
  phone: Smartphone,
  ticket: Ticket,
  bank: Landmark,
  transfer: ArrowLeftRight,
  loan: HandCoins,
  people: Users,
  person: User,
  target: Target,
  lifebuoy: LifeBuoy,
  plane: Plane,
  house: House,
  palmtree: Palmtree,
  heart: Heart,
  laptop: Laptop,
  gift: Gift,
  baby: Baby,
  piggy: PiggyBank,
  grad: GraduationCap,
  car_goal: Car,
  coins: Coins,
  repeat: Repeat,
  // Viajes
  bed: BedDouble,
  utensils: UtensilsCrossed,
  bag: ShoppingBag,
  package: Package,
  note: StickyNote,
  luggage: Luggage,
  globe: Globe,
  mountain: Mountain,
  tent: Tent,
  bus: Bus,
  map: MapIcon,
  city: Building2,
  nfc: Nfc,
  calendar: CalendarDays,
  calendarClock: CalendarClock,
  alert: TriangleAlert,
  check: CircleCheck,
  bug: Bug,
  flame: Flame,
  sparkles: Sparkles,
  chat: MessageCircle,
  book: BookOpen,
  chartPie: ChartPie,
  chartColumn: ChartColumn,
  chartLine: ChartLine,
  pulse: HeartPulse,
  upload: Upload,
  settings: Settings,
  scale: Scale,
  receipt: Receipt,
  sprout: Sprout,
  list: ListChecks,
  gem: Gem,
  tag: Tag,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Íconos que el usuario puede elegir para metas y categorías personalizadas. */
export const PICKABLE_ICONS: IconName[] = [
  'target',
  'lifebuoy',
  'plane',
  'palmtree',
  'house',
  'car_goal',
  'grad',
  'laptop',
  'gift',
  'heart',
  'baby',
  'piggy',
  'coins',
  'tag',
  'food',
  'coffee',
  'shopping',
  'health',
  'sports',
  'pets',
  'business',
  'entertainment',
  'clothing',
  'utilities',
];

/** Íconos para viajes. */
export const TRIP_ICONS: IconName[] = [
  'plane',
  'palmtree',
  'mountain',
  'city',
  'tent',
  'bus',
  'car_goal',
  'globe',
  'luggage',
  'map',
  'heart',
  'people',
];

/** Las metas/categorías guardan "i:nombre" cuando usan un ícono en vez de emoji. */
export const iconKey = (name: IconName) => `i:${name}`;
export function iconFromValue(value: string | undefined | null): LucideIcon | null {
  if (!value?.startsWith('i:')) return null;
  return (ICONS as Record<string, LucideIcon>)[value.slice(2)] ?? null;
}

export const LEVEL_ICONS: Record<Level, LucideIcon> = {
  basic: Sprout,
  organized: ListChecks,
  expert: Gem,
};

const ACCOUNT_TYPE_ICON: Record<Account['type'], LucideIcon> = {
  cash: Banknote,
  debit: CreditCard,
  credit: CreditCard,
  savings: PiggyBank,
  investment: TrendingUp,
  wallet: Smartphone,
  voucher: Ticket,
  loan: Landmark,
};

const KIND_ICON: Partial<Record<Transaction['kind'], LucideIcon>> = {
  transfer: ArrowLeftRight,
  debt_payment: CreditCard,
  loan_given: HandCoins,
  loan_received: HandCoins,
  loan_collected: CircleCheck,
  loan_repaid: CircleCheck,
  investment: TrendingUp,
  tanda: Coins,
};

export function useIconStyle(): 'simple' | 'emoji' {
  return useData((s) => s.settings.iconStyle ?? 'simple');
}

const SIZES = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
} as const;
const GLYPH = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' } as const;

/** Cuadrito con un ícono de línea y un tinte suave del color indicado. */
export function IconTile({
  icon: Icon,
  color,
  size = 'md',
  className,
  emoji,
}: {
  icon: LucideIcon;
  color?: string;
  size?: keyof typeof SIZES;
  className?: string;
  emoji?: string;
}) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center',
        SIZES[size],
        !color && 'bg-surface-2 text-ink/70',
        className,
      )}
      style={color ? { background: `${color}14`, color } : undefined}
    >
      {emoji ? (
        <span className={size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl'}>
          {emoji}
        </span>
      ) : (
        <Icon className={GLYPH[size]} strokeWidth={1.75} />
      )}
    </span>
  );
}

/** Ícono de categoría: línea sencilla (o el emoji, si el usuario lo prefiere). */
export function CatIcon({
  category,
  size = 'md',
  className,
}: {
  category: Pick<Category, 'id' | 'emoji' | 'color'> | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const style = useIconStyle();
  const custom = iconFromValue(category?.emoji);
  const Icon = custom ?? (ICONS as Record<string, LucideIcon>)[category?.id ?? ''] ?? Tag;
  const emoji = style === 'emoji' && category?.emoji && !custom ? category.emoji : undefined;
  return (
    <IconTile icon={Icon} color={category?.color} size={size} className={className} emoji={emoji} />
  );
}

export function AccountIcon({
  account,
  size = 'md',
  className,
}: {
  account: Pick<Account, 'type' | 'color' | 'icon'> | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const style = useIconStyle();
  const Icon = account ? ACCOUNT_TYPE_ICON[account.type] : Wallet;
  return (
    <IconTile
      icon={Icon}
      color={account?.color}
      size={size}
      className={className}
      emoji={style === 'emoji' ? account?.icon : undefined}
    />
  );
}

export function kindIcon(kind: Transaction['kind']): LucideIcon | undefined {
  return KIND_ICON[kind];
}

/** Ícono de una meta: "i:nombre" o, si es un emoji antiguo, uno por tipo. */
export function GoalIcon({
  value,
  type,
  size = 'lg',
}: {
  value: string;
  type: 'normal' | 'emergency';
  size?: keyof typeof SIZES;
}) {
  const style = useIconStyle();
  const Icon = iconFromValue(value) ?? (type === 'emergency' ? LifeBuoy : Target);
  return (
    <IconTile
      icon={Icon}
      size={size}
      className="bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-200"
      emoji={style === 'emoji' && !value.startsWith('i:') ? value : undefined}
    />
  );
}

/** Traductor emoji → ícono de línea (para textos/datos que traen emoji). */
const EMOJI_MAP: Record<string, LucideIcon> = {
  '💳': CreditCard,
  '✅': CircleCheck,
  '🏠': House,
  '🎉': PartyPopper,
  '🤝': Handshake,
  '🎯': Target,
  '🔁': Repeat,
  '📈': TrendingUp,
  '🫙': Coins,
  '💑': Users,
  '🐷': PiggyBank,
  '🏦': Landmark,
  '⚠️': TriangleAlert,
  '✍️': PenLine,
  '🔒': Lock,
  '💰': CircleDollarSign,
  '💵': Banknote,
  '🗓️': CalendarDays,
  '📦': Package,
  '🎓': GraduationCap,
  '☕': Coffee,
  '💡': Lightbulb,
  '🛟': LifeBuoy,
  '⚙️': Settings,
  '🔔': Bell,
  '📺': Tv,
  '📊': ChartColumn,
  '➕': Plus,
  '⚖️': Scale,
  '🏷️': Tag,
  '✨': Sparkles,
  '🐜': Bug,
  '📱': Smartphone,
  '🌱': Sprout,
  '💬': MessageCircle,
  '⛓️': Unlink,
  '⛓️‍💥': Unlink,
  '👵': Hand,
  '🧓': Hand,
  '🧾': Receipt,
  '💼': Briefcase,
  '🙋': User,
  '❓': CircleHelp,
  '🚨': Siren,
  '🍪': Cookie,
  '👤': User,
  '🎟️': Ticket,
  '🤷': CircleHelp,
  '🔥': Flame,
  '📥': ArrowDownToLine,
  '🎄': Gift,
  '💪': Trophy,
  '✈️': Plane,
  '🧳': Luggage,
  '🏨': BedDouble,
  '🌮': UtensilsCrossed,
  '🎬': Clapperboard,
  '⛽': Fuel,
  '🎁': Gift,
  '🔍': Search,
  '🔎': Search,
  '☁️': Cloud,
  '☀️': Sun,
  '🌙': Moon,
  '🧹': Eraser,
  '🧪': FlaskConical,
  '🎤': Mic,
  '📸': Camera,
  '🔧': Wrench,
  '✂️': Scissors,
  '🧠': Brain,
  '🥧': ChartPie,
  '🗺️': MapIcon,
  '⛄': Snowflake,
  '🏔️': Mountain,
  '🪙': Coins,
  '❤️': Heart,
  '🏛️': Landmark,
  '🔮': ChartLine,
  '📲': Smartphone,
  '🏆': Trophy,
  '🙂': Smile,
  '😐': Meh,
  '🛒': ShoppingCart,
  '🚕': CarTaxiFront,
  '🚗': Car,
  '💊': Pill,
  '🧸': Baby,
  '🐶': PawPrint,
  '🛵': Bike,
  '🛍️': ShoppingBag,
  '👕': Shirt,
  '🛋️': Sofa,
  '💇': Scissors,
  '🏋️': Dumbbell,
  '🍻': Beer,
  '💻': Laptop,
  '↩️': Undo2,
  '🩺': Stethoscope,
  '🛡️': Shield,
  '🕊️': Bird,
  '🚌': Bus,
  '💜': CreditCard,
  '🖐️': Hand,
  '🟢': Sprout,
  '🔵': ListChecks,
  '🟣': Gem,
  '❌': CircleAlert,
  '👑': Crown,
  '⏱️': Gauge,
};

export function iconForEmoji(emoji: string | undefined): LucideIcon {
  if (!emoji) return Sparkles;
  return (
    iconFromValue(emoji) ??
    EMOJI_MAP[emoji] ??
    EMOJI_MAP[emoji.replace(/\uFE0F/g, '')] ??
    EMOJI_MAP[`${emoji}\uFE0F`] ??
    Sparkles
  );
}

/** Muestra el ícono de línea que corresponde a un emoji (o el emoji, si el usuario los prefiere). */
export function EmojiIcon({
  emoji,
  className,
  strokeWidth = 1.75,
}: {
  emoji: string | undefined;
  className?: string;
  strokeWidth?: number;
}) {
  const style = useIconStyle();
  if (style === 'emoji' && emoji && !emoji.startsWith('i:'))
    return (
      <span aria-hidden className={className}>
        {emoji}
      </span>
    );
  const Icon = iconForEmoji(emoji);
  return (
    <Icon
      aria-hidden
      className={cx('inline-block', className ?? 'h-5 w-5')}
      strokeWidth={strokeWidth}
    />
  );
}

/** Quita emojis de un texto (para respuestas del asistente y textos heredados). */
export function stripEmoji(text: string): string {
  return text
    .replace(/\bi:[a-z_]+\s?/g, '')
    .replace(
      /(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{23F0}-\u{23FF}\u{1F1E6}-\u{1F1FF}]|\u{FE0F}|\u{200D})/gu,
      '',
    )
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^\s+/gm, '')
    .trim();
}

/** Cuadrícula para elegir un ícono (guarda "i:nombre"). */
export function IconPicker({
  value,
  onChange,
  label = 'Ícono',
  options = PICKABLE_ICONS,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  options?: IconName[];
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8" role="radiogroup" aria-label={label}>
        {options.map((name) => {
          const Icon = ICONS[name];
          const selected = value === iconKey(name);
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              onClick={() => onChange(iconKey(name))}
              className={cx(
                'flex aspect-square items-center justify-center rounded-xl border transition',
                selected
                  ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-200'
                  : 'border-line text-ink/70 hover:bg-surface-2',
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
