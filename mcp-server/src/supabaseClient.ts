import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const userEmail = process.env.MCP_USER_EMAIL;
const userPassword = process.env.MCP_USER_PASSWORD;

if (!supabaseUrl || !supabaseAnonKey || !userEmail || !userPassword) {
  console.error(
    "Missing SUPABASE_URL, SUPABASE_ANON_KEY, MCP_USER_EMAIL, or MCP_USER_PASSWORD. " +
      "Copy mcp-server/.env.example to mcp-server/.env and fill in your DoNext credentials.",
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
  },
});

let userId: string | null = null;

export async function getUserId(): Promise<string> {
  if (!userId) {
    throw new Error("Not signed in yet. Call signIn() before using getUserId().");
  }
  return userId;
}

export async function signIn(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: userEmail!,
    password: userPassword!,
  });

  if (error || !data.user) {
    console.error(
      `Failed to sign in to Supabase as ${userEmail}: ${error?.message ?? "unknown error"}`,
    );
    process.exit(1);
  }

  userId = data.user.id;
}

export { supabase };
