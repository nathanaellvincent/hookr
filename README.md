# hookr

Webhook relay server: receive HTTP POSTs, fan them out in real-time to WebSocket subscribers, and buffer the last 100 events per channel for replay.

## Why this project

Shows Node.js-specific patterns that are distinct from frontend JavaScript:

| Pattern | Where |
|---|---|
| `EventEmitter` as internal pub/sub bus | `src/events/bus.js` |
| `http.createServer` + Socket.IO on same port | `src/index.js` |
| `crypto.timingSafeEqual` for constant-time key compare | `src/middleware/auth.js` |
| Circular event buffer with `since` replay | `src/store/eventLog.js` |
| Rate limiting middleware (60 req/min) | `src/index.js` |

## Architecture

```
Sender → POST /hook/:channel  → EventLog (buffer)
                               → EventEmitter bus
                                     ↓
                               Socket.IO rooms (fan-out)
                                     ↓
                          WebSocket subscribers (real-time)
```

## Run

```bash
npm install
npm start            # production
npm run dev          # node --watch (auto-reload)
```

## Test

```bash
# terminal 1 — listen via wscat
npx wscat -c ws://localhost:3000
> {"event":"subscribe","data":{"channel":"payments"}}

# terminal 2 — send a webhook
curl -X POST localhost:3000/hook/payments \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key-change-me" \
  -d '{"amount":9900,"currency":"IDR","status":"captured"}'

# terminal 1 — see the event arrive in real-time
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP/WebSocket port |
| `API_KEYS` | `dev-key-change-me` | Comma-separated valid API keys |
