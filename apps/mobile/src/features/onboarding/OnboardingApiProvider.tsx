import { createContext, useContext, type PropsWithChildren } from 'react';
import type { OnboardingApi } from './api';
const Context = createContext<OnboardingApi | null>(null);
export function OnboardingApiProvider({ api, children }: PropsWithChildren<{ api: OnboardingApi }>) { return <Context.Provider value={api}>{children}</Context.Provider>; }
export function useOnboardingApi() { const api = useContext(Context); if (!api) throw new Error('OnboardingApiProvider required'); return api; }
