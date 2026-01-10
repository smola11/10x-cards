/// <reference types="astro/client" />

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      session: Session | null;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_KEY: string;
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  readonly OPENROUTER_API_KEY: string;
  readonly E2E_USER_ID?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
