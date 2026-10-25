import { getSupabase } from '../../lib/supabase';
import type { CarSelection } from './validation';
export type Role = 'rider' | 'car_owner' | 'both';
export type Community = { id: string; name: string; sort_order: number; active: boolean };
export type CarBrand = { id: string; name: string; active: boolean };
export type CarModel = CarBrand & { brand_id: string };
export type CarType = CarBrand & { code: string };
export type ProfileInput = { firstName: string; lastName: string; communityId: string; role: Role; ageConfirmed: boolean; termsVersion: string; privacyVersion: string };
export type CarInput = CarSelection & { submissionKey: string; year: number; plate: string };
export type SavedVehicle = { brand_id: string | null; brand_other: string | null; model_id: string | null; model_other: string | null; type_id: string; year: number; plate_number: string };
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type SubmissionResult = { revision: number; status: VerificationStatus; superseded: boolean };
export type Verification = { car_owner: { status: VerificationStatus; revision: number; reviewer_note: string | null } | null; has_car_details: boolean };
const codes = ['consent_version_stale', 'account_missing', 'invalid_name', 'invalid_community', 'invalid_role', 'age_not_confirmed', 'profile_missing', 'role_not_car_owner', 'invalid_car', 'invalid_plate', 'invalid_year', 'already_approved', 'stale_revision'] as const;
export type OnboardingErrorCode = typeof codes[number] | 'uncertain' | 'rejected' | 'unexpected_response';
export class OnboardingError extends Error {
 constructor(public readonly code: OnboardingErrorCode, public readonly classification: 'uncertain' | 'rejected') { super(code); this.name = 'OnboardingError'; }
}
type Response = { data: unknown; error: { message?: string } | null; status?: number };
type Query = PromiseLike<Response> & { eq(column: string, value: unknown): Query; order(column: string): Query };
// Separate from AuthClient: only the read queries and RPC boundary needed here.
export type OnboardingClient = { from(table: string): { select(columns: string): Query }; rpc(name: string, args?: Record<string, unknown>): PromiseLike<Response> };
export interface OnboardingApi {
 listCommunities(): Promise<Community[]>;
 currentLegalVersions(): Promise<{ terms: string; privacy: string }>;
 completeProfile(input: ProfileInput): Promise<void>;
 setRole(role: Role): Promise<void>;
 listCarBrands(): Promise<CarBrand[]>;
 listCarModels(brandId: string): Promise<CarModel[]>;
 listCarTypes(): Promise<CarType[]>;
 submitCar(input: CarInput): Promise<SubmissionResult>;
 myProfile(): Promise<{ role: Role } | null>;
 myVehicle(): Promise<SavedVehicle | null>;
 myVerification(): Promise<Verification>;
}
async function request<T>(run: () => PromiseLike<Response>): Promise<T> {
 let response: Response;
 try { response = await run(); } catch { throw new OnboardingError('uncertain', 'uncertain'); }
 if (!response) throw new OnboardingError('uncertain', 'uncertain');
 if (response.error || (response.status !== undefined && (response.status === 0 || response.status >= 400))) {
  const code = codes.find(code => code === response.error?.message);
  if (response.status !== undefined && (response.status >= 500 || [401, 408, 429].includes(response.status))) throw new OnboardingError('uncertain', 'uncertain');
  if (code) throw new OnboardingError(code, 'rejected');
  if (!response.status) throw new OnboardingError('uncertain', 'uncertain');
  throw new OnboardingError('rejected', 'rejected');
 }
 if (response.data === null && response.status === 0) throw new OnboardingError('uncertain', 'uncertain');
 return response.data as T;
}
export function adaptOnboardingClient(client: ReturnType<typeof getSupabase>): OnboardingClient {
 return {
  from: table => ({ select: columns => {
   let builder = client.from(table).select(columns);
   const query: Query = {
    eq: (column, value) => { builder = builder.eq(column, value); return query; },
    order: column => { builder = builder.order(column); return query; },
    then: (resolve, reject) => builder.then(result => ({ data: result.data as unknown, error: result.error, status: result.status })).then(resolve, reject),
   };
   return query;
  } }),
  rpc: async (name, args) => { const result = await client.rpc(name, args); return { data: result.data as unknown, error: result.error, status: result.status }; },
 };
}
export function createOnboardingApi(client: OnboardingClient = adaptOnboardingClient(getSupabase())): OnboardingApi {
 const list = <T>(table: string, order = 'name') => request<T[]>(() => client.from(table).select('*').eq('active', true).order(order));
 return {
  listCommunities: () => list<Community>('communities', 'sort_order'),
  listCarBrands: () => list<CarBrand>('car_brands'),
  listCarModels: brandId => request<CarModel[]>(() => client.from('car_models').select('*').eq('active', true).eq('brand_id', brandId).order('name')),
  listCarTypes: () => list<CarType>('car_types'),
  currentLegalVersions: async () => {
   const rows = await request<{ kind: string; version: string }[]>(() => client.from('legal_documents').select('kind,version').eq('is_current', true));
   const terms = rows?.find(row => row.kind === 'terms')?.version;
   const privacy = rows?.find(row => row.kind === 'privacy')?.version;
   if (!terms || !privacy) throw new OnboardingError('unexpected_response', 'uncertain');
   return { terms, privacy };
  },
  completeProfile: async input => { await request(() => client.rpc('complete_profile', { p_first_name: input.firstName, p_last_name: input.lastName, p_community_id: input.communityId, p_role: input.role, p_age_confirmed: input.ageConfirmed, p_terms_version: input.termsVersion, p_privacy_version: input.privacyVersion })); },
  setRole: async role => { await request(() => client.rpc('set_role', { p_role: role })); },
  submitCar: async input => {
   const result = await request<SubmissionResult>(() => client.rpc('submit_car', { p_submission_key: input.submissionKey, p_brand_id: input.brandId, p_brand_other: input.brandOther, p_model_id: input.modelId, p_model_other: input.modelOther, p_type_id: input.typeId, p_year: input.year, p_plate: input.plate }));
   if (!result || !Number.isInteger(result.revision) || result.revision < 1 || !['pending', 'approved', 'rejected'].includes(result.status) || typeof result.superseded !== 'boolean') throw new OnboardingError('unexpected_response', 'uncertain');
   return result;
  },
  myProfile: async () => (await request<{ role: Role }[]>(() => client.from('profiles').select('role')))[0] ?? null,
  myVehicle: async () => (await request<SavedVehicle[]>(() => client.from('vehicles').select('brand_id,brand_other,model_id,model_other,type_id,year,plate_number')))[0] ?? null,
  myVerification: () => request<Verification>(() => client.rpc('my_verification')),
 };
}
