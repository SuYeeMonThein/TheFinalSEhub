import { env } from "../config/env";
import { getSupabaseAdminClient } from "./supabaseClient";

export const getStorageClient = () => getSupabaseAdminClient().storage;

export const getBucket = (bucketName?: string) => {
  const resolvedBucket = bucketName ?? env.supabaseStorageBucket;

  if (!resolvedBucket) {
    throw new Error(
      "Supabase storage bucket name not provided. Set SUPABASE_STORAGE_BUCKET or pass a bucket name.",
    );
  }

  return getStorageClient().from(resolvedBucket);
};

/**
 * Upload a file to Supabase Storage.
 */
export const uploadFile = async (
  storagePath: string,
  fileBuffer: Buffer,
  contentType: string,
  bucketName?: string,
): Promise<void> => {
  const bucket = getBucket(bucketName);
  const { error } = await bucket.upload(storagePath, fileBuffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase storage upload failed: ${error.message}`);
  }
};

/**
 * Download a file from Supabase Storage.
 * Returns a Blob of the file content.
 */
export const downloadFile = async (
  storagePath: string,
  bucketName?: string,
): Promise<Blob> => {
  const bucket = getBucket(bucketName);
  const { data, error } = await bucket.download(storagePath);

  if (error || !data) {
    throw new Error(
      `Supabase storage download failed: ${error?.message ?? "No data returned"}`,
    );
  }

  return data;
};

/**
 * Generate a signed URL for a file (valid for the given number of seconds).
 */
export const getSignedUrl = async (
  storagePath: string,
  expiresInSeconds = 3600,
  bucketName?: string,
): Promise<string> => {
  const bucket = getBucket(bucketName);

  const { data, error } = await bucket.createSignedUrl(
    storagePath,
    expiresInSeconds,
  );

  if (error) {
    throw new Error(`Signed URL generation failed: ${error.message}`);
  }

  return data.signedUrl;
};
