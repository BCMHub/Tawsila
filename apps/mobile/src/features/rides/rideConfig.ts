import { getSupabase } from '../../lib/supabase';

export type PilotRoute = { id: string; fromName: string; toName: string };
export type RideCar = { label: string; passengerSeats: number };

export async function loadPilotRoutes(): Promise<PilotRoute[]> {
  const { data, error } = await getSupabase().from('routes')
    .select('id, from:places!routes_place_a_id_fkey!inner(name), to:places!routes_place_b_id_fkey!inner(name)')
    .eq('active', true)
    .order('sort_order')
    .order('id')
    .returns<{ id: string; from: { name: string }; to: { name: string } }[]>();
  if (error || !data) throw new Error('routes_unavailable');
  return data.map(({ id, from, to }) => ({ id, fromName: from.name, toName: to.name }));
}

export async function loadRideCar(): Promise<RideCar> {
  // The existing vehicle policy scopes this to the signed-in owner's car.
  const { data, error } = await getSupabase().from('vehicles')
    .select('brand:car_brands(name), model:car_models(name), type:car_types(name, passenger_seats)')
    .maybeSingle()
    .returns<{
      brand: { name: string } | null;
      model: { name: string } | null;
      type: { name: string; passenger_seats: number } | null;
    }>();
  if (error || !data?.type) throw new Error('car_unavailable');
  const names = data.brand ? [data.brand.name, data.model?.name].filter(Boolean).join(' ') : '';
  return {
    label: names ? `${names} · ${data.type.name}` : data.type.name,
    passengerSeats: data.type.passenger_seats,
  };
}
