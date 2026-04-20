import { config as loadEnv } from 'dotenv';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!process.env.GCLOUD_PROJECT && !process.env.FUNCTIONS_RUNTIME_ENV) {
  loadEnv();
}

const [, , uid, roleArg] = process.argv;

const role = roleArg ?? 'coordinator';

if (!uid) {
  // eslint-disable-next-line no-console
  console.error('Usage: npm run set:coordinator -- <uid> [role]');
  process.exit(1);
}

const app = initializeApp({
  credential: applicationDefault()
});

const auth = getAuth(app);

(async () => {
  try {
    await auth.setCustomUserClaims(uid, { role });
    const user = await auth.getUser(uid);
    // eslint-disable-next-line no-console
    console.log(`Updated custom claims for ${user.uid}. Role set to: ${role}`);
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to set coordinator role', error);
    process.exit(1);
  }
})();
