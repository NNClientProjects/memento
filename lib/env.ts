import { z } from 'zod';

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),

  GOOGLE_SERVICE_ACCOUNT_KEYFILE: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON_B64: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_SHEETS_REFRESH_TOKEN: z.string().optional(),

  MASTER_SHEET_ID: z.string().min(1),
  FORM_RESPONSES_SHEET_ID: z.string().optional(),

  ROUTER_BASE_URL: z.string().url().optional(),
  ROUTER_API_SECRET: z.string().optional(),
  ROUTER_CLAIM_PATH: z.string().optional(),
  INBOUND_FORWARD_SECRET: z.string().optional(),

  META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  META_WHATSAPP_WABA_ID: z.string().optional(),
  META_WHATSAPP_ACCESS_TOKEN: z.string().optional(),

  AISENSY_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  OPT_OUT_SECRET: z.string().optional(),
  APP_BASE_URL: z.string().url().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  AUTH_COOKIE_SECRET: z.string().optional(),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid env: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

export function hasServiceAccount(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEYFILE ||
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64
  );
}

export function hasOAuthRefreshToken(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_SHEETS_REFRESH_TOKEN
  );
}

export function hasWhatsAppRouter(): boolean {
  return Boolean(process.env.ROUTER_BASE_URL && process.env.ROUTER_API_SECRET);
}

export function hasMetaWhatsApp(): boolean {
  return Boolean(
    process.env.META_WHATSAPP_PHONE_NUMBER_ID &&
      process.env.META_WHATSAPP_ACCESS_TOKEN
  );
}
