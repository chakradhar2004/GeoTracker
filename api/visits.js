// api/visits.js — Vercel Serverless Function
// GET    /api/visits → return all visits
// DELETE /api/visits → clear all visits
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: Return all visits ──
  if (req.method === 'GET') {
    const result = await redis(['LRANGE', 'geotracker:visits', '0', '-1']);
    const visits = (result.result || [])
      .map(v => { try { return JSON.parse(v); } catch { return null; } })
      .filter(Boolean);
    return res.status(200).json(visits);
  }

  // ── DELETE: Clear all visits ──
  if (req.method === 'DELETE') {
    await redis(['DEL', 'geotracker:visits']);
    console.log('[Database Cleared] All visit logs deleted.');
    return res.status(200).json({ success: true, message: 'Database cleared successfully' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
