import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_KEY;

export type SupabaseClient = ReturnType<typeof createClient<Database>>;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Local development default user id used when auth is not enforced
// In E2E tests, this can be overridden with E2E_USER_ID environment variable
export const DEFAULT_USER_ID = import.meta.env.E2E_USER_ID ?? "4b156f43-6dfa-4641-8555-4315eb28765b";
