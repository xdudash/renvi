import { useLocalSearchParams } from 'expo-router';
import { BackLink, Screen } from '@/components/ui';
import { LockedMode } from '@/components/LockedMode';
import { useModes } from '@/hooks/useModes';

// people-locked · closed mode (dating or couples) with the reason and the way to open it.
export default function PeopleLocked() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { modes } = useModes();
  return (
    <Screen tabs="discover">
      <BackLink />
      <LockedMode mode={mode === 'couples' ? 'couples' : 'dating'} modes={modes} />
    </Screen>
  );
}
