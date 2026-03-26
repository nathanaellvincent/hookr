// API-key auth for inbound webhook POSTs.
// Real deployments should rotate keys via env vars and use constant-time compare.

import { timingSafeEqual } from 'crypto'

const ALLOWED_KEYS = new Set(
  (process.env.API_KEYS ?? 'dev-key-change-me').split(',').map(k => k.trim())
)

function safeCompare(a, b) {
  const ba = Buffer.from(a.padEnd(64))
  const bb = Buffer.from(b.padEnd(64))
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export function requireApiKey(req, res, next) {
  const key =
    req.headers['x-api-key'] ??
    req.query.api_key ??
    ''

  const valid = [...ALLOWED_KEYS].some(k => safeCompare(key, k))
  if (!valid) {
    return res.status(401).json({ error: 'invalid or missing API key' })
  }
  next()
}
