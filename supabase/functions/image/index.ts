// Supabase Edge Function: generate a post image with Google Imagen (Gemini API),
// store it in the public `post-images` bucket, and return its URL.
// Verifies the caller's session and workspace membership. Uses the server-side
// GEMINI_API_KEY (separate from the Claude key).
//
// Deploy:  supabase functions deploy image
//          supabase secrets set GEMINI_API_KEY=...

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });
}

const IMAGE_MODEL = 'imagen-4.0-generate-001';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing auth token' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Not authenticated' }, 401);
  const uid = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const prompt = (body && typeof body.prompt === 'string') ? body.prompt.trim() : '';
  const pngBase64 = (body && typeof body.pngBase64 === 'string') ? body.pngBase64 : '';
  const workspaceId = body && body.workspaceId;
  const postId = body && body.postId;
  const aspectRatio = (body && body.aspectRatio) || '16:9';
  if (!workspaceId || !postId) return json({ error: 'Missing workspace/post' }, 400);
  if (!prompt && !pngBase64) return json({ error: 'Missing prompt or image' }, 400);

  const admin = createClient(url, serviceKey);

  // Authorize: caller must belong to the workspace.
  const { data: mem } = await admin.from('members').select('user_id').eq('workspace_id', workspaceId).eq('user_id', uid).maybeSingle();
  if (!mem) return json({ error: 'Not a member of this workspace' }, 403);

  // Path 1: a pre-rendered figure (PNG) — just store it.
  let b64: string;
  if (pngBase64) {
    b64 = pngBase64;
  } else {
    // Path 2: generate a photo with Imagen.
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
    if (!geminiKey) return json({ error: 'Server is missing GEMINI_API_KEY' }, 500);
    const model = (body && body.model) || IMAGE_MODEL;
    const genRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio, personGeneration: 'allow_adult' },
      }),
    });
    if (!genRes.ok) {
      let msg = 'Image generation failed (HTTP ' + genRes.status + ')';
      try { const j = await genRes.json(); msg = j?.error?.message || msg; } catch { /* ignore */ }
      return json({ error: msg }, genRes.status);
    }
    const gen = await genRes.json();
    const pred = (gen.predictions || [])[0];
    const got = pred && (pred.bytesBase64Encoded || pred.image?.imageBytes);
    if (!got) return json({ error: 'No image returned (possibly blocked by safety filters)' }, 502);
    b64 = got;
  }

  // Decode base64 → bytes and upload to the public bucket.
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const path = `${workspaceId}/${postId}-${Date.now()}.png`;
  const { error: upErr } = await admin.storage.from('post-images').upload(path, bytes, { contentType: 'image/png', upsert: true });
  if (upErr) return json({ error: 'Upload failed: ' + upErr.message }, 500);
  const { data: pub } = admin.storage.from('post-images').getPublicUrl(path);

  return json({ url: pub.publicUrl });
});
