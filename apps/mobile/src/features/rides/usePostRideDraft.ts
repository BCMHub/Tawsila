import { randomUUID } from 'expo-crypto';
import { createContext, createElement, useContext, useState, type PropsWithChildren } from 'react';
import type { PublishRideInput } from './api';

type Route = Pick<PublishRideInput, 'routeId' | 'direction'>;
type Schedule = Pick<PublishRideInput, 'date' | 'time' | 'flexMinutes' | 'repeat'>;
type CarDetails = Pick<PublishRideInput, 'seats' | 'pickupNote' | 'notes'>;

export type PostRideDraft = {
  route: Route | null;
  schedule: Schedule | null;
  carDetails: CarDetails | null;
};

type PostRideDraftContextValue = {
  draft: PostRideDraft;
  setRoute: (route: Route) => void;
  setSchedule: (schedule: Schedule) => void;
  setCarDetails: (carDetails: CarDetails) => void;
  clear: () => void;
  getOrCreateRequestId: (reviewVisitKey: string) => string;
};

const emptyDraft: PostRideDraft = { route: null, schedule: null, carDetails: null };
const PostRideDraftContext = createContext<PostRideDraftContextValue | null>(null);

export function PostRideDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState(emptyDraft);
  const [requestIds] = useState(() => {
    let review: { visitKey: string; requestId: string } | null = null;
    return {
      clear: () => { review = null; },
      getOrCreate: (visitKey: string) => {
        if (review?.visitKey !== visitKey) {
          review = { visitKey, requestId: randomUUID() };
        }
        return review.requestId;
      },
    };
  });

  const value: PostRideDraftContextValue = {
    draft,
    setRoute: route => setDraft(current => ({ ...current, route })),
    setSchedule: schedule => setDraft(current => ({ ...current, schedule })),
    setCarDetails: carDetails => setDraft(current => ({ ...current, carDetails })),
    clear: () => {
      requestIds.clear();
      setDraft(emptyDraft);
    },
    getOrCreateRequestId: requestIds.getOrCreate,
  };

  return createElement(PostRideDraftContext.Provider, { value }, children);
}

export function usePostRideDraft() {
  const value = useContext(PostRideDraftContext);
  if (!value) throw new Error('PostRideDraftProvider required');
  return value;
}
