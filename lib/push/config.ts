// Server-only configuration: import this module only from route handlers/workers.
export function pushServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const dispatchSecret = process.env.WEB_PUSH_DISPATCH_SECRET;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;
  if (!url || !secretKey || !dispatchSecret || dispatchSecret.length < 32 || !privateKey || !publicKey || !subject) return null;
  if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey) || !/^[A-Za-z0-9_-]{43}$/.test(privateKey) || !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject)) return null;
  return { url, secretKey, dispatchSecret, privateKey, publicKey, subject };
}
