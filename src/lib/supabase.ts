import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export function createAnonClient() {
	return createClient(supabaseUrl, supabaseKey);
}

export function createServiceRoleClient() {
	if (!supabaseServiceRoleKey) {
		throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service role operations.');
	}

	return createClient(supabaseUrl, supabaseServiceRoleKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
	});
}
