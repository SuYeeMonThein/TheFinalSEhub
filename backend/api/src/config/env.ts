import { config as loadEnv } from "dotenv";

if (!process.env.GCLOUD_PROJECT && !process.env.FUNCTIONS_RUNTIME_ENV) {
  loadEnv();
}

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseAnonKey: requireEnv("SUPABASE_ANON_KEY"),
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET,
  port: Number(process.env.PORT ?? 5001),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:8080")
    .split(",")
    .map((s) => s.trim()),
};
