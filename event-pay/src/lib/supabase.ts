export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "payment-screenshots";

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey, bucket };
}

export function getSupabaseHeaders() {
  const config = getSupabaseConfig();
  if (!config) return null;

  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

export async function supabaseJson<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const config = getSupabaseConfig();
  const headers = getSupabaseHeaders();

  if (!config || !headers) {
    throw new Error("Supabase is not configured");
  }

  const response = await fetch(`${config.url}${endpoint}`, {
    ...init,
    headers: {
      ...headers,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
