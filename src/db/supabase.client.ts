import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_KEY;

export type SupabaseClient = ReturnType<typeof createClient<Database>>;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Local development default user id used when auth is not enforced
export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";
