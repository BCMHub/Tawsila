import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ErrorState, LoadingState } from '../../components/States';
import { strings } from '../../strings';
import type { SharedRideResult } from './api';
import { RideDetailWithShare } from './RideDetail';
import { RideScreen } from './RideScreen';
import { useRidesApi } from './RidesApiProvider';
import { useRideResource } from './useRideResource';

function backToBoard() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function RideDetailRequest({ load, shared = false }: { load: () => Promise<SharedRideResult>; shared?: boolean }) {
  const { result, retry } = useRideResource(load);
  if (result.status === 'ready') return <RideDetailWithShare detail={result.value} onBack={backToBoard} shared={shared} />;
  return <RideScreen title={shared ? strings.rides.sharedRide : strings.rides.detail} onBack={backToBoard}>
    {result.status === 'loading' ? <LoadingState /> : <ErrorState onRetry={retry} />}
  </RideScreen>;
}

export function ListRideRoute() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const api = useRidesApi();
  const load = useCallback(async (): Promise<SharedRideResult> => {
    const ride = await api.getRide(id, source === 'published' ? 'published' : 'list');
    return { state: ride.state, ride };
  }, [api, id, source]);
  return <RideDetailRequest load={load} />;
}

export function SharedRideDetail({ code }: { code: string }) {
  const api = useRidesApi();
  const load = useCallback(() => api.resolveSharedRide(code), [api, code]);
  return <RideDetailRequest load={load} shared />;
}
