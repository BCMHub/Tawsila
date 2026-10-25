import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
// Session display only; never part of the profile payload.
export function useSessionEmail() {
 const [email, setEmail] = useState('');
 useEffect(() => {
  let active = true;
  let receivedEvent = false;
  try {
   const client = getSupabase();
   void client.auth.getSession().then(({ data }) => { if (active && !receivedEvent) setEmail(data.session?.user.email ?? ''); }).catch(() => {});
   const { data } = client.auth.onAuthStateChange((_event, session) => { receivedEvent = true; if (active) setEmail(session?.user.email ?? ''); });
   return () => { active = false; data.subscription.unsubscribe(); };
  } catch { return () => { active = false; }; }
 }, []);
 return email;
}
