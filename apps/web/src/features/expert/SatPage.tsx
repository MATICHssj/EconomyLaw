import { useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { DEDUCTIBLE_CATEGORIES, FORMA_PAGO, USO_CFDI, cfdiDeductibility, formatLongDate, generalDeductionLimitCents, parseCfdiXml, type Cfdi } from '@fina/core';
import { applyChanges } from '@/lib/actions';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { Badge, Card, CardTitle, Money, PageHeader, Select, Stat, Tip } from '@/components/ui';

async function readCfdiFiles(files: FileList): Promise<string[]> {
  const out: string[] = [];
  for (const f of Array.from(files)) {
    if (f.name.toLowerCase().endsWith('.zip')) {
      const { unzipSync, strFromU8 } = await import('fflate');
      const entries = unzipSync(new Uint8Array(await f.arrayBuffer()));
      for (const [name, data] of Object.entries(entries)) if (name.toLowerCase().endsWith('.xml')) out.push(strFromU8(data));
    } else out.push(await f.text());
  }
  return out;
}

export default function SatPage() {
  const cfdis = useData((s) => s.data.cfdi);
  const txs = useData((s) => s.data.transactions);
  const profile = useData((s) => s.profile);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  async function onFiles(files: FileList) {
    const xmls = await readCfdiFiles(files);
    const changes = [];
    let skipped = 0;
    for (const xml of xmls) {
      const c = parseCfdiXml(xml);
      if (!c) {
        skipped++;
        continue;
      }
      const d = cfdiDeductibility(c);
      // Emparejar con un movimiento del mismo monto ±5 días.
      const match = txs.find((t) => t.amountMxnCents === c.totalCents && Math.abs(Date.parse(t.date) - Date.parse(c.fecha)) <= 5 * 86_400_000);
      const doc: Cfdi = { id: c.uuid, rfcEmisor: c.rfcEmisor, nombre: c.nombreEmisor, totalCents: c.totalCents, fecha: c.fecha, usoCfdi: c.usoCfdi, formaPago: c.formaPago, metodoPago: c.metodoPago, deductible: d.deductible ? d.categoryId : null, txId: match?.id ?? null, createdAt: new Date().toISOString() };
      changes.push({ space: 'personal' as const, col: 'cfdi' as const, before: null, after: doc });
      if (match && d.deductible && !match.deductible) changes.push({ space: match.space, col: 'transactions' as const, before: match, after: { ...match, deductible: d.categoryId ?? undefined } });
    }
    await applyChanges(changes);
    toast(`${changes.filter((c) => c.col === 'cfdi').length} facturas leídas${skipped ? ` (${skipped} no eran CFDI)` : ''}`, 'success');
  }

  const summary = useMemo(() => {
    const inYear = cfdis.filter((c) => c.fecha.startsWith(year));
    const byCat: Record<string, number> = {};
    for (const c of inYear) if (c.deductible) byCat[c.deductible] = (byCat[c.deductible] ?? 0) + c.totalCents;
    // Movimientos marcados a mano como deducibles (sin factura cargada)
    const manual = txs.filter((t) => t.deductible && t.date.startsWith(year) && !inYear.some((c) => c.txId === t.id));
    for (const t of manual) byCat[t.deductible!] = (byCat[t.deductible!] ?? 0) + t.amountMxnCents;
    const business = txs.filter((t) => t.tags.includes('negocio') && t.date.startsWith(year) && t.kind === 'expense').reduce((s, t) => s + t.amountMxnCents, 0);
    return { inYear, byCat, total: Object.values(byCat).reduce((a, b) => a + b, 0), manualCount: manual.length, business };
  }, [cfdis, txs, year]);

  const income = (profile?.monthlyIncomeCents ?? 0) * 12;
  const limit = income ? generalDeductionLimitCents(income) : null;

  return (
    <div className="space-y-4">
      <PageHeader title="SAT y deducibles" subtitle="Junta tus facturas para tu declaración anual (abril)." back />
      <Select aria-label="Año fiscal" value={year} onChange={(e) => setYear(e.target.value)} options={[0, 1, 2].map((i) => String(new Date().getFullYear() - i)).map((y) => ({ value: y, label: `Ejercicio ${y}` }))} />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Deducciones personales" value={<Money cents={summary.total} />} hint={`${summary.inYear.length} facturas · ${summary.manualCount} marcados a mano`} />
        <Stat label="Tope estimado" value={limit ? <Money cents={limit} /> : '—'} hint={limit ? 'menor entre 15 % de tu ingreso o 5 UMA' : 'Pon tu ingreso en Ajustes'} />
      </div>
      <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-surface p-6 text-center hover:border-accent-400">
        <Upload className="h-6 w-6 text-accent-500" />
        <span>
          <span className="block font-semibold text-ink">Subir facturas (XML o ZIP)</span>
          <span className="text-sm text-muted">Las descargas del portal del SAT o te las mandan por correo</span>
        </span>
        <input type="file" multiple accept=".xml,.zip" className="sr-only" onChange={(e) => e.target.files && void onFiles(e.target.files)} />
      </label>
      <Card>
        <CardTitle>Por tipo de deducción</CardTitle>
        <ul className="space-y-2">
          {DEDUCTIBLE_CATEGORIES.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-ink">
                  {d.emoji} {d.name}
                </p>
                <p className="text-xs text-muted">{d.help}</p>
              </div>
              <Money cents={summary.byCat[d.id] ?? 0} className="shrink-0 font-semibold text-ink" />
            </li>
          ))}
        </ul>
      </Card>
      {summary.inYear.length > 0 && (
        <Card>
          <CardTitle>Facturas del año</CardTitle>
          <ul className="divide-y divide-line">
            {summary.inYear
              .sort((a, b) => b.fecha.localeCompare(a.fecha))
              .map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="truncate font-medium text-ink">{c.nombre}</span>
                    <Money cents={c.totalCents} className="font-semibold text-ink" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {formatLongDate(c.fecha)} · {c.rfcEmisor} · {USO_CFDI[c.usoCfdi] ?? c.usoCfdi} · {FORMA_PAGO[c.formaPago ?? ''] ?? c.formaPago}
                    {c.deductible ? <Badge tone="good">Deducible</Badge> : <Badge>No deducible</Badge>}
                    {c.txId && <Badge tone="accent">Ligada a movimiento</Badge>}
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      )}
      {summary.business > 0 && (
        <Card>
          <p className="text-sm text-muted">Gastos con #negocio en {year}</p>
          <Money cents={summary.business} className="text-xl font-bold text-ink" />
          <p className="text-xs text-muted">Útil si eres persona física con actividad empresarial o RESICO. Consulta a tu contador.</p>
        </Card>
      )}
      <Tip emoji="⚠️">Para que un gasto médico sea deducible, la factura debe estar a tu nombre (o de tu cónyuge/hijos), con uso D01 y pagada con tarjeta o transferencia, no en efectivo. Esto es una guía: revisa con tu contador.</Tip>
    </div>
  );
}
