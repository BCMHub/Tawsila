const names = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
for (const name of names) if (!process.env[name]) throw Error(`Integration environment missing ${name}; supply LOCAL Supabase credentials through the command environment. Tests never skip.`);
export const url = process.env.SUPABASE_URL!;
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw Error('Integration tests require a LOCAL Supabase URL');
export const anonKey = process.env.SUPABASE_ANON_KEY!;
export const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
