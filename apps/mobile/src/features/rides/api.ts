import { getSupabase } from '../../lib/supabase';
import { strings } from '../../strings';

export type RideDirection = 'a_to_b' | 'b_to_a';
export type RideRepeat = 'once' | 'weekdays';
export type RideState = 'available' | 'full' | 'departed' | 'cancelled' | 'withdrawn';
export type RideSource = 'list' | 'published';
export type PublishGate = 'ok' | 'phone_unverified' | 'car_not_approved' | 'profile_incomplete';

export type RideProjection = {
  ride_id: string;
  share_code: string;
  route_id: string;
  direction: RideDirection;
  from_name: string;
  from_area: string | null;
  to_name: string;
  to_area: string | null;
  duration_minutes: number;
  ride_date: string;
  departure_time: string;
  departs_at: string;
  flex_minutes: number;
  seats_offered: number;
  seats_left: number;
  repeat: RideRepeat;
  pickup_note: string | null;
  notes: string | null;
  created_at: string;
  state: RideState;
  is_own: boolean;
  owner_display: string;
  owner_initials: string;
  owner_member_since: string;
  owner_phone_verified: boolean;
  car_label: string | null;
};

export type PublishRideInput = {
  requestId: string;
  routeId: string;
  direction: RideDirection;
  date: string;
  time: string;
  flexMinutes: number;
  seats: number;
  pickupNote: string | null;
  notes: string | null;
  repeat: RideRepeat;
};

export type PublishRideResult = {
  seriesId: string;
  rideId: string;
  shareCode: string;
  rideCount: number;
  replayed: boolean;
};

export type RideListInput = {
  routeId: string;
  direction: RideDirection;
  day?: string | null;
  after?: { departsAt: string; rideId: string } | null;
  limit?: number | null;
};

export type SharedRideResult =
  | { state: 'not_found' }
  | { state: RideState; ride: RideProjection };

type RpcResponse = { data: unknown; error: { message?: string } | null; status?: number };

export type RidesClient = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResponse>;
};

export interface RidesApi {
  canPublish(): Promise<PublishGate>;
  publishRide(input: PublishRideInput): Promise<PublishRideResult>;
  listRides(input: RideListInput): Promise<RideProjection[]>;
  getRide(id: string, source: RideSource): Promise<RideProjection>;
  resolveSharedRide(code: string): Promise<SharedRideResult>;
}

export type RidesErrorCode = keyof typeof strings.rides.errors;
export type RideMessageKey = `rides.errors.${RidesErrorCode}`;

export class RidesError extends Error {
  constructor(
    public readonly code: RidesErrorCode,
    public readonly classification: 'uncertain' | 'rejected',
    public readonly messageKey: RideMessageKey,
  ) {
    super(code);
    this.name = 'RidesError';
  }
}

function isErrorCode(code: unknown): code is RidesErrorCode {
  return typeof code === 'string' && Object.hasOwn(strings.rides.errors, code);
}

export function publishErrorMessageKey(code: string): RideMessageKey {
  return `rides.errors.${isErrorCode(code) ? code : 'rejected'}`;
}

function uncertainError() {
  return new RidesError('uncertain', 'uncertain', 'rides.errors.uncertain');
}

async function request<T>(run: () => PromiseLike<RpcResponse>): Promise<T> {
  let response: RpcResponse;
  try {
    response = await run();
  } catch {
    throw uncertainError();
  }

  if (!response) throw uncertainError();
  const { data, error, status } = response;
  if (status === 0 || status === 401 || status === 408 || status === 429 || (status !== undefined && status >= 500)) {
    throw uncertainError();
  }
  if (error || (status !== undefined && status >= 400)) {
    const code = error?.message;
    if (isErrorCode(code) && code !== 'uncertain' && code !== 'rejected') {
      throw new RidesError(code, 'rejected', publishErrorMessageKey(code));
    }
    if (status === undefined) throw uncertainError();
    throw new RidesError('rejected', 'rejected', 'rides.errors.rejected');
  }

  if (data == null) throw uncertainError();
  return data as T;
}

export function adaptRidesClient(client: ReturnType<typeof getSupabase>): RidesClient {
  return {
    rpc: async (name, args) => {
      const { data, error, status } = await client.rpc(name, args);
      return { data, error, status };
    },
  };
}

type PublishRideRow = {
  series_id: string;
  ride_id: string;
  share_code: string;
  ride_count: number;
  replayed: boolean;
};

export function createRidesApi(client: RidesClient = adaptRidesClient(getSupabase())): RidesApi {
  const rpc = <T>(name: string, args?: Record<string, unknown>) =>
    request<T>(() => client.rpc(name, args));

  return {
    async canPublish() {
      const gate = await rpc<PublishGate>('can_publish');
      if (gate !== 'ok' && gate !== 'phone_unverified' && gate !== 'car_not_approved' && gate !== 'profile_incomplete') {
        throw uncertainError();
      }
      return gate;
    },
    async publishRide(input) {
      const result = await rpc<PublishRideRow>('publish_ride', {
        p_request_id: input.requestId,
        p_route_id: input.routeId,
        p_direction: input.direction,
        p_date: input.date,
        p_time: input.time,
        p_flex_minutes: input.flexMinutes,
        p_seats: input.seats,
        p_pickup_note: input.pickupNote,
        p_notes: input.notes,
        p_repeat: input.repeat,
      });
      if (typeof result.series_id !== 'string' || typeof result.ride_id !== 'string' ||
          typeof result.share_code !== 'string' || !Number.isInteger(result.ride_count) ||
          result.ride_count < 1 || typeof result.replayed !== 'boolean') {
        throw uncertainError();
      }
      return {
        seriesId: result.series_id,
        rideId: result.ride_id,
        shareCode: result.share_code,
        rideCount: result.ride_count,
        replayed: result.replayed,
      };
    },
    listRides: input => rpc('list_rides', {
      p_route_id: input.routeId,
      p_direction: input.direction,
      p_day: input.day ?? null,
      p_after_departs_at: input.after?.departsAt ?? null,
      p_after_id: input.after?.rideId ?? null,
      p_limit: input.limit ?? null,
    }),
    getRide: (id, source) => rpc('get_ride', { p_ride_id: id, p_source: source }),
    resolveSharedRide: code => rpc('resolve_shared_ride', { p_code: code }),
  };
}
