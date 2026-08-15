import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env';

if (!process.env.GCLOUD_PROJECT && !process.env.FUNCTIONS_RUNTIME_ENV) {
  loadEnv();
}

const [, , bucketArg] = process.argv;
const bucketName = bucketArg ?? env.supabaseStorageBucket;

if (!bucketName) {
  // eslint-disable-next-line no-console
  console.error('Usage: npm run storage:create -- <bucket-name>\nAlternatively set SUPABASE_STORAGE_BUCKET in your environment.');
  process.exit(1);
}

(async () => {
  const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);

  try {
    const { data, error } = await supabase.storage.createBucket(bucketName, { public: false });

    if (error) {
      if (error.message.includes('already exists')) {
        // eslint-disable-next-line no-console
        console.info(`Bucket "${bucketName}" already exists.`);
        process.exit(0);
      }

      throw error;
    }

    // eslint-disable-next-line no-console
    console.log(`Created Supabase bucket: ${data?.name ?? bucketName}`);
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to create Supabase bucket', error);
    process.exit(1);
  }
})();
