import { EmptyState } from '../../components/States';
import { strings } from '../../strings';
import { RideScreen } from './RideScreen';

export function NotVerifiedRide({ onBack }: { onBack: () => void }) {
  return <RideScreen title={strings.rides.post} onBack={onBack}>
    <EmptyState title={strings.rides.notVerifiedTitle} body={strings.rides.notVerifiedBody} />
  </RideScreen>;
}
