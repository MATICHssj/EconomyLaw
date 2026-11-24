import { allocateCents } from './money';
import type { Household, Loan, Split, Transaction } from './schemas';
import { isSpending } from './balances';

// ——————————————————— Préstamos personales y gastos compartidos ———————————————————

export interface PersonBalance {
  person: string;
  /** + te deben, − les debes */
  netCents: number;
  items: Array<{ type: 'loan' | 'split'; id: string; description: string; amountCents: number }>;
}

/** Quién te debe y a quién le debes (préstamos + gastos compartidos sin pagar). */
export function balancesByPerson(loans: Loan[], splits: Split[]): PersonBalance[] {
  const map = new Map<string, PersonBalance>();
  const get = (name: string) => {
    const key = name.trim().toLowerCase();
    let pb = map.get(key);
    if (!pb) {
      pb = { person: name.trim(), netCents: 0, items: [] };
      map.set(key, pb);
    }
    return pb;
  };
  for (const l of loans) {
    if (l.closed) continue;
    const pending = l.amountCents - l.paidCents;
    if (pending <= 0) continue;
    const sign = l.direction === 'lent' ? 1 : -1;
    const pb = get(l.person);
    pb.netCents += sign * pending;
    pb.items.push({ type: 'loan', id: l.id, description: l.note || (sign > 0 ? 'Préstamo' : 'Te prestó'), amountCents: sign * pending });
  }
  for (const s of splits) {
    for (const p of s.participants) {
      if (p.isMe || p.paid) continue;
      const pb = get(p.name);
      pb.netCents += p.shareCents;
      pb.items.push({ type: 'split', id: s.id, description: s.description, amountCents: p.shareCents });
    }
  }
  return [...map.values()].filter((p) => p.netCents !== 0).sort((a, b) => Math.abs(b.netCents) - Math.abs(a.netCents));
}

/** Busca el préstamo abierto más antiguo con esa persona (para "Juan me pagó 200"). */
export function findOpenLoan(loans: Loan[], person: string, direction: 'lent' | 'borrowed'): Loan | undefined {
  const p = person.trim().toLowerCase();
  return loans
    .filter((l) => !l.closed && l.direction === direction && l.person.trim().toLowerCase() === p && l.paidCents < l.amountCents)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
}

// ——————————————————— Modo pareja / familia: "cuentas claras" ———————————————————

export interface CoupleBalance {
  totalSharedCents: number;
  members: Array<{ uid: string; name: string; paidCents: number; fairShareCents: number; diffCents: number }>;
  /** Transferencia sugerida para quedar a mano. */
  settlement: { fromUid: string; toUid: string; amountCents: number } | null;
}

/**
 * Compara lo que cada quien pagó de los gastos comunes contra lo que "le toca"
 * (50/50, proporcional al ingreso o personalizado).
 */
export function coupleBalance(household: Household, sharedTransactions: Transaction[]): CoupleBalance {
  const members = household.members;
  const spending = sharedTransactions.filter((t) => isSpending(t));
  const total = spending.reduce((s, t) => s + t.amountMxnCents, 0);
  const paid: Record<string, number> = Object.fromEntries(members.map((m) => [m, 0]));
  for (const t of spending) {
    const payer = t.createdBy && t.createdBy in paid ? t.createdBy : members[0]!;
    paid[payer] = (paid[payer] ?? 0) + t.amountMxnCents;
  }
  const weights = members.map((m) =>
    household.splitMode === 'equal' ? 1 : Math.max(0, household.weights[m] ?? 1),
  );
  const shares = allocateCents(total, weights);
  const rows = members.map((uid, i) => ({
    uid,
    name: household.memberNames[uid] ?? 'Integrante',
    paidCents: paid[uid] ?? 0,
    fairShareCents: shares[i] ?? 0,
    diffCents: (paid[uid] ?? 0) - (shares[i] ?? 0),
  }));
  let settlement: CoupleBalance['settlement'] = null;
  if (rows.length >= 2) {
    const sorted = [...rows].sort((a, b) => a.diffCents - b.diffCents);
    const debtor = sorted[0]!;
    const creditor = sorted[sorted.length - 1]!;
    const amount = Math.min(-debtor.diffCents, creditor.diffCents);
    if (amount > 0) settlement = { fromUid: debtor.uid, toUid: creditor.uid, amountCents: amount };
  }
  return { totalSharedCents: total, members: rows, settlement };
}
