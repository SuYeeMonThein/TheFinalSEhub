import { config as loadEnv } from 'dotenv';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Load .env for local dev if not running in a cloud environment
if (!process.env.GCLOUD_PROJECT && !process.env.FUNCTIONS_RUNTIME_ENV) {
  loadEnv();
}

const [, , emailArg, roleArg] = process.argv;

const email = emailArg;
const role = roleArg ?? 'coordinator';

if (!email) {
  // eslint-disable-next-line no-console
  console.error('Usage: npm run set:role:email -- <email> [role]');
  process.exit(1);
}

const app = initializeApp({
  credential: applicationDefault()
});

const auth = getAuth(app);

(async () => {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, { role });
    // eslint-disable-next-line no-console
    console.log(`Updated custom claims for ${user.uid} (${email}). Role set to: ${role}`);
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to set role by email', error);
    process.exit(1);
  }
})();
