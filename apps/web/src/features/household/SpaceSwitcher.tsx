import { useData, type SpaceFilter } from '@/stores/data';
import { Segmented } from '@/components/ui';

/** Solo aparece en modo pareja/familia: ver todo, solo lo mío o solo lo del hogar. */
export function SpaceSwitcher({ className }: { className?: string }) {
  const household = useData((s) => s.household);
  const value = useData((s) => s.spaceFilter);
  const set = useData((s) => s.setSpaceFilter);
  if (!household) return null;
  return (
    <Segmented<SpaceFilter>
      className={className}
      label="Qué ver"
      value={value}
      onChange={set}
      options={[
        { value: 'all', label: 'Todo' },
        { value: 'personal', label: 'Mío' },
        { value: 'household', label: household.name },
      ]}
    />
  );
}
