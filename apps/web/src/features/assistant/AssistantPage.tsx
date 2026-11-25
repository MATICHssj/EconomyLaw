import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { BRAND } from '@fina/core';
import { askAssistant } from '@fina/parser';
import { useToday } from '@/lib/finance';
import { useData } from '@/stores/data';
import { Chip, PageHeader, cx } from '@/components/ui';

interface Msg {
  from: 'me' | 'fina';
  text: string;
}

const SUGGESTIONS = ['¿En qué se me va el dinero?', '¿Cuánto gasté en Uber este mes?', '¿Me alcanza para unos tenis de 1800?', '¿Cómo voy con mi presupuesto de comida?', '¿Cuánto debo?', '¿Quién me debe?', 'Mis gastos hormiga'];

/** Chat que responde con consultas reales a tus datos (no inventa números). Funciona sin internet. */
export default function AssistantPage() {
  const data = useData((s) => s.data);
  const profile = useData((s) => s.profile);
  const privacy = useData((s) => s.settings.privacyMode);
  const today = useToday();
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'fina', text: `¡Hola! Soy ${BRAND.assistantName} ✨. Pregúntame sobre tu dinero: respondo con tus datos reales, sin inventar.` }]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [msgs]);

  function ask(q: string) {
    if (!q.trim()) return;
    const a = askAssistant(q, { today, transactions: data.transactions, categories: data.categories, accounts: data.accounts, budgets: data.budgets, plans: data.installmentPlans, loans: data.loans, splits: data.splits, debts: data.debts, payday: profile?.payday });
    const answer = privacy ? a.text.replace(/\$[\d,.]+/g, '$••••') : a.text;
    setMsgs((m) => [...m, { from: 'me', text: q }, { from: 'fina', text: answer }]);
    setText('');
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      <PageHeader title={`Pregúntale a ${BRAND.assistantName}`} back />
      <div className="flex-1 space-y-3" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={cx('flex', m.from === 'me' ? 'justify-end' : 'justify-start')}>
            <div className={cx('max-w-[85%] rounded-2xl px-4 py-2.5 whitespace-pre-line', m.from === 'me' ? 'rounded-br-sm bg-accent-600 text-white' : 'rounded-bl-sm bg-surface text-ink shadow-sm')}>
              {m.from === 'fina' && <Sparkles className="mb-1 h-4 w-4 text-accent-500" />}
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mt-4 space-y-2 bg-bg pt-2 lg:bottom-0">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {SUGGESTIONS.map((s) => (
            <Chip key={s} onClick={() => ask(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <form
          className="flex items-center gap-2 rounded-2xl border-2 border-line bg-surface px-3 focus-within:border-accent-500"
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe tu pregunta…" aria-label="Pregunta" className="min-w-0 flex-1 bg-transparent py-3 text-ink outline-none focus-visible:outline-none" />
          <button type="submit" aria-label="Enviar" className="rounded-full bg-accent-600 p-2 text-white disabled:opacity-40" disabled={!text.trim()}>
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
