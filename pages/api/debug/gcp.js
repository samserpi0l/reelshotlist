import { Storage } from '@google-cloud/storage';

export default async function handler(req, res) {
  try {
    const present = {
      GCP_SERVICE_ACCOUNT: !!process.env.GCP_SERVICE_ACCOUNT,
      GCP_BUCKET: !!process.env.GCP_BUCKET,
    };
    if (!present.GCP_SERVICE_ACCOUNT || !present.GCP_BUCKET) {
      return res.status(200).json({ ok:false, present, note:'Setze GCP_SERVICE_ACCOUNT (base64) und GCP_BUCKET (Name).' });
    }
    const creds = JSON.parse(Buffer.from(process.env.GCP_SERVICE_ACCOUNT, 'base64').toString('utf8'));
    const storage = new Storage({ credentials: creds, projectId: creds.project_id });
    const bucket = storage.bucket(process.env.GCP_BUCKET);
    const [exists] = await bucket.exists();
    return res.status(200).json({ ok:true, present, project_id: creds.project_id, bucket: process.env.GCP_BUCKET, bucket_exists: exists });
  } catch (e) {
    return res.status(200).json({ ok:false, error: e.message || String(e) });
  }
}
