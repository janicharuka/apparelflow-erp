// Creates the 3 demo users in Supabase Auth + public.users profile rows.
// Usage: npm run seed:users   (reads .env.local)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = "Demo@12345"; // must match src/lib/demo.ts

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const DEMO_USERS = [
  { email: "supervisor@apparelflow.demo", full_name: "Nimal Perera", role: "cutting_supervisor" },
  { email: "verifier@apparelflow.demo", full_name: "Kumari Silva", role: "cutting_verifier" },
  { email: "sewing@apparelflow.demo", full_name: "Ruwan Fernando", role: "sewing_supervisor" },
];

async function findUserByEmail(email) {
  for (let page = 1; page < 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

for (const u of DEMO_USERS) {
  let user = await findUserByEmail(u.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (error) throw error;
    user = data.user;
    console.log(`created auth user ${u.email}`);
  } else {
    await admin.auth.admin.updateUserById(user.id, { password });
    console.log(`auth user exists ${u.email} (password reset)`);
  }

  const { error: profileError } = await admin
    .from("users")
    .upsert({ id: user.id, email: u.email, full_name: u.full_name, role: u.role });
  if (profileError) throw profileError;
  console.log(`  profile -> ${u.role}`);
}

console.log(`\nDone. All demo users use password: ${password}`);
