import { randomBytes } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { adminAuth } from '../src/config/firebase';
import { getSupabaseClient } from '../src/services/supabaseClient';
import { sendWelcomeEmail } from '../src/services/emailService';

if (!process.env.GCLOUD_PROJECT && !process.env.FUNCTIONS_RUNTIME_ENV) {
  loadEnv();
}

// Replaces the old shared default password ("Student@123") on existing student
// accounts with a random one nobody knows. Students then sign in through the
// "Forgot password?" link, or the "Set your password" link if --send-links is used.
//
//   npm run reset:student-passwords                  # dry run, lists accounts
//   npm run reset:student-passwords -- --apply       # sets random passwords
//   npm run reset:student-passwords -- --apply --send-links
const apply = process.argv.includes('--apply');
const sendLinks = process.argv.includes('--send-links');

(async () => {
  const supabase = getSupabaseClient();

  const { data: students, error } = await supabase
    .from('user')
    .select('id, name, email')
    .eq('role', 'student');
  if (error) throw error;

  // Anyone who also holds an advisor/coordinator role is left alone.
  const { data: staffRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['advisor', 'coordinator']);
  const staffIds = new Set((staffRoles ?? []).map((r) => r.user_id));

  const targets = (students ?? []).filter((s) => s.email && !staffIds.has(s.id));
  console.log(`${targets.length} student account(s)${apply ? '' : ' (dry run, nothing changed)'}`);

  let changed = 0;
  for (const s of targets) {
    try {
      const fb = await adminAuth.getUserByEmail(s.email);
      if (!apply) {
        console.log(`- ${s.email}`);
        continue;
      }
      await adminAuth.updateUser(fb.uid, {
        password: `${randomBytes(18).toString('base64url')}aA1!`,
      });
      await adminAuth.revokeRefreshTokens(fb.uid);
      if (sendLinks) {
        await sendWelcomeEmail({ name: s.name, email: s.email, role: 'student' });
      }
      changed += 1;
      console.log(`reset ${s.email}`);
    } catch (err) {
      console.log(`skip ${s.email}: ${(err as Error).message}`);
    }
  }
  if (apply) console.log(`Done: ${changed} password(s) replaced.`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
