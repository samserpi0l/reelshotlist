// pages/api/reels/scrape.js
import { Storage } from '@google-cloud/storage';
import { VideoIntelligenceServiceClient } from '@google-cloud/video-intelligence';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream';

const streamPipeline = promisify(pipeline);

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } } // wir streamen die Videodaten, kein großer Body
};

function isInstaReel(u='') {
  try {
    const url = new URL(u);
    return /instagram\.com$/.test(url.hostname) && (/\/reel\/|\/reels\//.test(url.pathname));
  } catch { return false; }
}

function parseB64Json(b64) {
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

async function fetchMp4FromRapidAPI(reelUrl) {
  const host = process.env.RAPIDAPI_HOST;
  const key  = process.env.RAPIDAPI_KEY;
  if (!host || !key) throw new Error('RAPIDAPI_HOST/RAPIDAPI_KEY fehlen');

  // Der von dir gewählte Anbieter nutzt üblicherweise GET /index?url=...
  const endpoint = `https://${host}/index?url=${encodeURIComponent(reelUrl)}`;
  const r = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': key,
      'X-RapidAPI-Host': host
    }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`RapidAPI ${r.status}: ${text.slice(0,400)}`);

  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`RapidAPI invalid JSON: ${text.slice(0,400)}`); }

  // MP4-URL Kandidaten (der Anbieter kann unterschiedliche Feldnamen liefern)
  const candidates = [
    data?.video, data?.video_url, data?.media, data?.download_url,
    data?.result?.video, data?.result?.video_url, data?.result?.link,
    data?.links?.mp4, data?.links?.download, data?.url
  ].filter(Boolean);

  const mp4 = candidates.find(u => typeof u === 'string' && u.includes('.mp4')) || candidates[0];
  if (!mp4) throw new Error('Kein MP4-Link in der RapidAPI-Antwort gefunden');

  const title = data?.title || data?.caption || 'Instagram Reel';
  const duration = Number(data?.duration || data?.video_duration || data?.result?.duration);

  return { mp4Url: mp4, title, duration_sec: Number.isFinite(duration) ? duration : null };
}

async function uploadToGCS({ mp4Url, objectName, bucket, creds }) {
  const storage = new Storage({ credentials: creds, projectId: creds.project_id });
  const file = storage.bucket(bucket).file(objectName);

  const resp = await fetch(mp4Url);
  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(()=> '');
    throw new Error(`Download MP4 fehlgeschlagen: ${resp.status} ${t.slice(0,200)}`);
  }

  await streamPipeline(
    resp.body,
    file.createWriteStream({ contentType: 'video/mp4', resumable: false })
  );

  return `gs://${bucket}/${objectName}`;
}

async function detectShots({ gcsUri, creds }) {
  const client = new VideoIntelligenceServiceClient({ credentials: creds, projectId: creds.project_id });
  const request = { inputUri: gcsUri, features: ['SHOT_CHANGE_DETECTION'] };

  const [operation] = await client.annotateVideo(request);
  const [result] = await operation.promise();

  const ann = result.annotationResults?.[0]?.shotAnnotations || [];
  return ann.map((s, i) => {
    const start = (Number(s.startTimeOffset?.seconds || 0) + Number(s.startTimeOffset?.nanos || 0) / 1e9);
    const end   = (Number(s.endTimeOffset?.seconds || 0) + Number(s.endTimeOffset?.nanos || 0) / 1e9);
    return {
      id: i + 1,
      start,
      end,
      description: '',
      objects: [],
      people: [],
      location: '',
      action: ''
    };
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });

    // einfacher Schutz per Secret
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || token !== process.env.VIDEO_SCRAPER_KEY) {
      return res.status(401).json({ ok:false, error:'Unauthorized' });
    }

    const { url } = req.body || {};
    if (!url || !isInstaReel(url)) {
      return res.status(400).json({ ok:false, error:'Bitte einen gültigen Instagram Reel-Link senden.' });
    }

    // GCP-ENVs prüfen
    if (!process.env.GCP_SERVICE_ACCOUNT || !process.env.GCP_BUCKET) {
      return res.status(500).json({ ok:false, error:'GCP_SERVICE_ACCOUNT/GCP_BUCKET fehlen' });
    }
    const creds = parseB64Json(process.env.GCP_SERVICE_ACCOUNT);
    const bucket = process.env.GCP_BUCKET;

    // 1) MP4 von RapidAPI holen
    const { mp4Url, title, duration_sec } = await fetchMp4FromRapidAPI(url);

    // 2) In GCS hochladen (streamend)
    const objectName = `reels/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
    const gcsUri = await uploadToGCS({ mp4Url, objectName, bucket, creds });

    // 3) Shots erkennen
    const scenes = await detectShots({ gcsUri, creds });

    return res.status(200).json({ ok: true, title, duration_sec, scenes });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message || 'Server error' });
  }
}
