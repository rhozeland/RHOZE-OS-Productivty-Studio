import { supabase } from "@/integrations/supabase/client";

const PRIVATE_BUCKETS = ["smartboard-files", "moodboard"];
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * For private buckets, uploads a file and returns a signed URL.
 * For public buckets, returns the public URL as before.
 */
export async function uploadAndGetUrl(
  bucket: string,
  path: string,
  file: File
): Promise<{ url: string; error: string | null }> {
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) return { url: "", error: error.message };

  if (PRIVATE_BUCKETS.includes(bucket)) {
    const { data, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_EXPIRY);
    if (signErr || !data) return { url: "", error: signErr?.message || "Failed to create signed URL" };
    return { url: data.signedUrl, error: null };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

/**
 * Checks if a URL belongs to a private bucket and returns a fresh signed URL.
 * If it's not a storage URL or belongs to a public bucket, returns it as-is.
 */
export async function resolveStorageUrl(url: string): Promise<string> {
  if (!url) return url;

  for (const bucket of PRIVATE_BUCKETS) {
    const bucketPattern = `/storage/v1/object/public/${bucket}/`;
    const signedPattern = `/storage/v1/object/sign/${bucket}/`;
    
    let filePath: string | null = null;
    
    if (url.includes(bucketPattern)) {
      filePath = url.split(bucketPattern)[1]?.split("?")[0];
    } else if (url.includes(signedPattern)) {
      filePath = url.split(signedPattern)[1]?.split("?")[0];
    }
    
    if (filePath) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(decodeURIComponent(filePath), SIGNED_URL_EXPIRY);
      if (!error && data) return data.signedUrl;
    }
  }

  return url;
}
