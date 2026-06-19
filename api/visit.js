// api/visit.js — Vercel Serverless Function
// POST /api/visit  → log a new visitor
// Uses Upstash Redis REST API for persistent storage

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  return res.json();
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { browserCoords, ipInfo, userAgent, screenResolution, language } = req.body;

  // Resolve real IP from Vercel forwarded headers
  const rawIp =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    'Unknown';

  const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ''].includes(rawIp);
  const ip = isLocal ? (ipInfo?.ip || rawIp) : rawIp;

  const visit = {
    id:               Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    timestamp:        new Date().toISOString(),
    ip,
    userAgent:        userAgent || null,
    screenResolution: screenResolution || null,
    language:         language || null,
    browserCoords:    browserCoords || null,
    ipInfo:           ipInfo || null,
  };

  // Push to Redis list (newest first) and trim to last 1000 entries
  await redis(['LPUSH', 'geotracker:visits', JSON.stringify(visit)]);
  await redis(['LTRIM', 'geotracker:visits', '0', '999']);

  console.log(`[Visit Logged] IP: ${ip} | City: ${ipInfo?.city || 'Unknown'} | GPS: ${browserCoords ? 'Yes' : 'No'}`);

  return res.status(201).json({ success: true, visitId: visit.id });
}
