import { PageHeader } from '@/components/ui';

export default function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  return <PageHeader title={doc} back />;
}
