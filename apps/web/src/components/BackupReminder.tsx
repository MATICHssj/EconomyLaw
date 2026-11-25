import { useState } from 'react';
import { HardDriveDownload } from 'lucide-react';
import { backupDue, exportAllJson, snoozeBackup } from '@/lib/exporter';
import { useSession } from '@/stores/session';
import { useData } from '@/stores/data';
import { Button, Card } from './ui';

/** Sin cuenta, los datos solo viven en este teléfono: cada 30 días pide un respaldo. */
export function BackupReminder() {
  const mode = useSession((s) => s.mode);
  const txCount = useData((s) => s.data.transactions.length);
  const [hidden, setHidden] = useState(false);
  if (hidden || !backupDue(txCount, mode === 'local')) return null;
  return (
    <Card className="flex items-start gap-3 border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30">
      <HardDriveDownload className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="flex-1">
        <p className="font-semibold text-ink">Haz un respaldo</p>
        <p className="text-sm text-muted">
          Sin cuenta, tus datos solo viven en este teléfono. Guarda una copia en tu Drive o
          mándatela por WhatsApp.
        </p>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              await exportAllJson();
              setHidden(true);
            }}
          >
            Guardar respaldo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              snoozeBackup();
              setHidden(true);
            }}
          >
            Luego
          </Button>
        </div>
      </div>
    </Card>
  );
}
