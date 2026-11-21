import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { clearPendingSharedRide } from '../../features/rides/pendingSharedRide';
import { SharedRideDetail } from '../../features/rides/RideDetailRoute';

export default function SharedRideRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  useEffect(() => {
    clearPendingSharedRide();
  }, [code]);
  return <SharedRideDetail code={code} />;
}
