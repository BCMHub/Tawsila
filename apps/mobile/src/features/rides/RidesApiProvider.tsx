import { createContext, useContext, type PropsWithChildren } from 'react';
import type { RidesApi } from './api';

const RidesApiContext = createContext<RidesApi | null>(null);

export function RidesApiProvider({ api, children }: PropsWithChildren<{ api: RidesApi }>) {
  return <RidesApiContext.Provider value={api}>{children}</RidesApiContext.Provider>;
}

export function useRidesApi() {
  const api = useContext(RidesApiContext);
  if (!api) throw new Error('RidesApiProvider required');
  return api;
}
