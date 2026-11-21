// My Fast server. Deployed as the Supabase Edge Function "fast-api" in the my-fleet project.
//
// POST { action: "register", email, password, code } -> create account (invited email + its one-time code)
// POST { action: "publicKey" }                        -> key the phone needs to sign up for notifications
// POST { action: "test" }            (logged in)      -> test notification to that person's phones
// POST { action: "push", items }     (x-cron-token)   -> due reminders, sent by fast_tick() every minute
// POST { action: "invites" }         (administrator)  -> list invited emails, their codes and who joined
// POST { action: "invite", email }   (administrator)  -> invite an email; returns its one-time code
// POST { action: "uninvite", email } (administrator)  -> remove access (their fasts are kept)
// POST { action: "adminReset", email } (administrator) -> temporary password for an invited person
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPush, type Subscription, type VapidKeys } from "./webpush.ts";

const SUBJECT = "https://ttomov88.github.io/my-fast/";
const ADMIN_EMAIL = "ttomov88@gmail.com";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function configValues(keys: string[]): Promise<Record<string, string>> {
  const { data, error } = await admin.from("app_config").select("key, value").in("key", keys);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
}

// The same notification keys My Fleet created; only the public half ever leaves the server.
async function getVapid(): Promise<VapidKeys> {
  const cfg = await configValues(["vapid_private", "vapid_public"]);
  if (!cfg.vapid_private || !cfg.vapid_public) throw new Error("vapid keys missing");
  return { privateJwk: JSON.parse(cfg.vapid_private), publicKey: cfg.vapid_public };
}

async function pushToUser(userId: string, payload: unknown, vapid: VapidKeys) {
  const { data: subs, error } = await admin.from("fast_push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId);
  if (error) throw error;
  let sent = 0, failed = 0;
  for (const s of (subs ?? []) as Subscription[]) {
    try {
      const r = await sendPush(s, payload, vapid, SUBJECT, 3600);
      if (r.ok) sent++;
      else {
        failed++;
        if (r.gone) await admin.from("fast_push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    } catch (_) { failed++; }
  }
  return { phones: subs?.length ?? 0, sent, failed };
}

async function currentUser(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data, error } = await admin.auth.getUser(jwt);
  return error || !data?.user ? null : data.user;
}

async function requireAdmin(req: Request) {
  const u = await currentUser(req);
  if (!u) return json({ error: "not_logged_in" }, 401);
  if ((u.email ?? "").toLowerCase() !== ADMIN_EMAIL) return json({ error: "forbidden" }, 403);
  return null;
}

async function register(body: any) {
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
  if (password.length < 8 || password.length > 72) return json({ error: "weak_password" }, 400);
  const code = String(body.code ?? "").trim().toUpperCase();
  const { data: allow, error: aErr } = await admin.from("fast_allowed_emails").select("email, code").eq("email", email).maybeSingle();
  if (aErr) throw aErr;
  if (!allow) return json({ error: "not_allowed" }, 403);
  // Someone who already has an account (e.g. from My Fleet) just logs in.
  const { data: existing } = await admin.rpc("user_id_of_email", { e: email });
  if (existing) return json({ error: "already_registered" }, 409);
  if (!allow.code || !timingSafeEqual(code, allow.code)) return json({ error: "bad_code" }, 403);
  const { error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr) {
    if (/already/i.test(cErr.message ?? "")) return json({ error: "already_registered" }, 409);
    throw cErr;
  }
  await admin.from("fast_allowed_emails").update({ code: null }).eq("email", email);   // one-time
  return json({ ok: true });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function inviteCode(): string {
  const set = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(6)), x => set[x % set.length]).join("");
}

function fmtHours(h: number, lang: string) {
  let whole = Math.floor(h), min = Math.round((h - whole) * 60);
  if (min === 60) { whole++; min = 0; }
  const [hu, mu] = lang === "en" ? ["h", "m"] : ["ч", "м"];
  return min ? `${whole}${hu} ${min}${mu}` : `${whole}${hu}`;
}

// Notifications in each person's language (Bulgarian unless they chose English).
function message(kind: string, hours: string, lang: string) {
  if (lang === "en") {
    return kind === "goal"
      ? { title: "Goal reached 🎉", body: `You've fasted ${hours}. Keep going or end your fast.`, tag: "my-fast-goal" }
      : { title: "Time to start fasting", body: `Tap to start your ${hours} fast.`, tag: "my-fast-start" };
  }
  return kind === "goal"
    ? { title: "Целта е постигната 🎉", body: `Фастът ви е ${hours}. Продължете или го приключете.`, tag: "my-fast-goal" }
    : { title: "Време е за фаст", body: `Докоснете, за да започнете ${hours} фаст.`, tag: "my-fast-start" };
}

async function push(req: Request, body: any) {
  const { cron_token } = await configValues(["cron_token"]);
  if (!cron_token || req.headers.get("x-cron-token") !== cron_token) return json({ error: "forbidden" }, 403);
  const items = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
  const vapid = await getVapid();
  const report = [];
  for (const it of items) {
    const lang = it.lang === "en" ? "en" : "bg";
    const msg = message(it.kind, fmtHours(Number(it.hours) || 0, lang), lang);
    report.push({ kind: it.kind, ...(await pushToUser(String(it.user_id), msg, vapid)) });
  }
  return json({ sent: report });
}

async function test(req: Request) {
  const u = await currentUser(req);
  if (!u) return json({ error: "not_logged_in" }, 401);
  return json(await pushToUser(u.id, { title: "My Fast", body: "Notifications are working.", tag: "my-fast-test" }, await getVapid()));
}

async function invites(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { data, error } = await admin.from("fast_allowed_emails").select("email, code").neq("email", ADMIN_EMAIL).order("added_at");
  if (error) throw error;
  const people = [];
  for (const r of data ?? []) {
    const { data: uid } = await admin.rpc("user_id_of_email", { e: r.email });
    people.push({ email: r.email, code: uid ? null : r.code, joined: !!uid });
  }
  return json({ people });
}

async function invite(req: Request, body: any, add: boolean) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
  if (email === ADMIN_EMAIL) return json({ error: "forbidden" }, 403);
  if (!add) {
    const { error } = await admin.from("fast_allowed_emails").delete().eq("email", email);
    if (error) throw error;
    return json({ ok: true });
  }
  const { data: existing } = await admin.from("fast_allowed_emails").select("code").eq("email", email).maybeSingle();
  const code = existing?.code ?? inviteCode();
  const { error } = await admin.from("fast_allowed_emails").upsert({ email, code }, { onConflict: "email" });
  if (error) throw error;
  return json({ ok: true, code });
}

function tempPassword(): string {
  const digits = "23456789", letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const pick = (set: string, n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n)), x => set[x % set.length]).join("");
  return `Fast-${pick(digits, 4)}-${pick(letters, 4)}`;
}
async function adminReset(req: Request, body: any) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const email = String(body.email ?? "").trim().toLowerCase();
  const { data: allow } = await admin.from("fast_allowed_emails").select("email").eq("email", email).maybeSingle();
  if (!allow || email === ADMIN_EMAIL) return json({ error: "no_such_member" }, 404);
  const { data: uid, error: uErr } = await admin.rpc("user_id_of_email", { e: email });
  if (uErr) throw uErr;
  if (!uid) return json({ error: "not_registered" }, 404);
  const password = tempPassword();
  const { error } = await admin.auth.admin.updateUserById(uid as string, { password });
  if (error) throw error;
  return json({ password });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case "register": return await register(body);
      case "publicKey": return json({ publicKey: (await getVapid()).publicKey });
      case "test": return await test(req);
      case "push": return await push(req, body);
      case "invites": return await invites(req);
      case "invite": return await invite(req, body, true);
      case "uninvite": return await invite(req, body, false);
      case "adminReset": return await adminReset(req, body);
      default: return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
