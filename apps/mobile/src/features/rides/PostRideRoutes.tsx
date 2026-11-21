import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { EmptyState } from '../../components/States';
import { strings } from '../../strings';
import { useTheme } from '../../theme';
import type { PublishGate } from './api';
import { carApproval, leavePost, PostEntryState, PostRideFlow, type PostStep } from './PostRideFlow';
import { loadPilotRoutes, loadRideCar } from './rideConfig';
import { rideWindow } from './rideDates';
import { RideScreen } from './RideScreen';
import { useRidesApi } from './RidesApiProvider';
import { PostRideDraftProvider } from './usePostRideDraft';
import { useRideResource } from './useRideResource';

function usePostSession() {
  const api = useRidesApi();
  const [blocked, setBlocked] = useState<PublishGate>();
  const load = useCallback(async () => {
    const gate = await api.canPublish();
    if (gate !== 'ok') return { gate };
    const [routes, car] = await Promise.all([loadPilotRoutes(), loadRideCar()]);
    return { gate, routes, car, window: rideWindow() };
  }, [api]);

  return { ...useRideResource(load), blocked, setBlocked };
}

const PostSession = createContext<ReturnType<typeof usePostSession> | null>(null);

function PostRideSession({ children }: PropsWithChildren) {
  const session = usePostSession();
  const gate = session.blocked ?? (session.result.status === 'ready' ? session.result.value.gate : undefined);
  useEffect(() => {
    if (gate === 'car_not_approved') carApproval();
  }, [gate]);
  return <PostSession.Provider value={session}>{children}</PostSession.Provider>;
}

export function PostLayout() {
  const t = useTheme();
  return <PostRideDraftProvider><PostRideSession>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t['bg/base'] } }} />
  </PostRideSession></PostRideDraftProvider>;
}

function PostStepRoute({ step }: { step: PostStep }) {
  const session = useContext(PostSession);
  if (!session) throw new Error('PostRideSession required');
  const { result, retry, blocked, setBlocked } = session;
  const { routeId } = useLocalSearchParams<{ routeId?: string }>();
  const data = result.status === 'ready' ? result.value : undefined;
  const gate = blocked ?? data?.gate;
  if (blocked || data?.gate !== 'ok') return <PostEntryState gate={gate === 'car_not_approved' ? undefined : gate}
    failed={result.status === 'error'} retry={retry} onBack={leavePost} />;
  const { routes, car, window } = data;
  const route = routes?.find(option => option.id === routeId) ?? routes?.[0];
  if (!routes || !route || !car || !window) return <RideScreen title={strings.rides.post} onBack={leavePost}>
    <EmptyState title={strings.rides.routesUnavailable} body={strings.rides.routesUnavailableBody} />
  </RideScreen>;
  return <PostRideFlow step={step} route={route} routes={routes} car={car} window={window}
    onNext={() => router.push(step === 'schedule' ? '/post/car' : '/post/review')}
    onBack={step === 'schedule' ? leavePost : () => router.back()}
    onBlocked={setBlocked} missingDraft={<Redirect href="/post" />} />;
}

export function ScheduleRoute() { return <PostStepRoute step="schedule" />; }
export function CarAndSeatsRoute() { return <PostStepRoute step="car" />; }
export function ReviewRoute() { return <PostStepRoute step="review" />; }
