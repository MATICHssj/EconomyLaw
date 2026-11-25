import { addDays, addMonths, type ISODate } from './dates';
import type { Tanda } from './schemas';

export interface TandaRound {
  n: number;
  date: ISODate;
  isMyTurn: boolean;
}

export function tandaRoundDate(t: Pick<Tanda, 'startDate' | 'frequency'>, index: number): ISODate {
  switch (t.frequency) {
    case 'weekly':
      return addDays(t.startDate, 7 * index);
    case 'biweekly':
      return addDays(t.startDate, 14 * index);
    case 'monthly':
      return addMonths(t.startDate, index);
  }
}

/** Calendario de una tanda: una ronda por participante; en tu número recibes el "pozo". */
export function tandaSchedule(t: Tanda): TandaRound[] {
  return Array.from({ length: t.participants }, (_, i) => ({
    n: i + 1,
    date: tandaRoundDate(t, i),
    isMyTurn: i + 1 === t.myTurn,
  }));
}

export interface TandaStatus {
  potCents: number;
  totalContributionCents: number;
  paidRounds: number;
  paidCents: number;
  nextPayment: TandaRound | null;
  myPayoutDate: ISODate;
  received: boolean;
  finished: boolean;
  /** Antes de tu turno la tanda es un "préstamo" que te hacen; después, un ahorro que debes. */
  position: 'saving' | 'owing' | 'done';
}

export function tandaStatus(t: Tanda, today: ISODate): TandaStatus {
  const schedule = tandaSchedule(t);
  const paidRounds = schedule.filter((r) => r.date <= today).length;
  const myRound = schedule[t.myTurn - 1]!;
  const finished = paidRounds >= t.participants;
  const received = t.received || myRound.date <= today;
  return {
    potCents: t.contributionCents * t.participants,
    totalContributionCents: t.contributionCents * t.participants,
    paidRounds,
    paidCents: paidRounds * t.contributionCents,
    nextPayment: schedule.find((r) => r.date > today) ?? null,
    myPayoutDate: myRound.date,
    received,
    finished,
    position: finished ? 'done' : received ? 'owing' : 'saving',
  };
}
