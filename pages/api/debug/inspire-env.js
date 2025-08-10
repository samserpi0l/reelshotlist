// pages/api/debug/inspire-env.js
export default async function handler(req, res) {
  const keys = [
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ALLOW_FREE_INSPIRATION'
  ];
  const present = Object.fromEntries(keys.map(k => [k, !!process.env[k]]));
  res.status(200).json({ env_present: present, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' });
}
