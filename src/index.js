import express from 'express'
import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'
import rateLimit from 'express-rate-limit'
import webhookRouter from './routes/webhook.js'
import bus from './events/bus.js'
import { replay } from './store/eventLog.js'

const app = express()
const httpServer = createServer(app)
const io = new SocketIO(httpServer, { cors: { origin: '*' } })

app.use(express.json({ limit: '1mb' }))

// 60 inbound webhook POSTs per minute per IP
app.use(
  '/hook',
  rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false })
)

app.use('/hook', webhookRouter)

app.get('/', (_req, res) => res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>hookr</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#08111f;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;flex-direction:column}
main{max-width:680px;margin:0 auto;padding:4rem 2rem;flex:1}
h1{font-size:2rem;font-weight:700;color:#fff;letter-spacing:-0.02em}
.tag{display:inline-block;margin-top:.6rem;padding:.2rem .7rem;background:#1a0f44;color:#a78bfa;border-radius:9999px;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.lead{color:#94a3b8;margin-top:1rem;line-height:1.65;font-size:.95rem}
h2{font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#475569;margin:2.5rem 0 .75rem}
.row{display:flex;align-items:baseline;gap:.9rem;padding:.65rem 1rem;border-radius:8px;margin-bottom:.4rem;background:#0d1b2e}
.m{font-family:'SF Mono','Fira Code',monospace;font-size:.75rem;font-weight:700;min-width:3rem}
.m.post{color:#34d399}.m.get{color:#60a5fa}.m.ws{color:#a78bfa}
.p{font-family:'SF Mono','Fira Code',monospace;font-size:.85rem;color:#e2e8f0;flex:1}
.d{font-size:.78rem;color:#475569}
pre{background:#0d1b2e;border:1px solid #1e293b;border-radius:8px;padding:1.2rem 1.4rem;font-family:'SF Mono','Fira Code',monospace;font-size:.8rem;color:#94a3b8;overflow-x:auto;line-height:1.7}
.c{color:#60a5fa}.s{color:#34d399}.k{color:#a78bfa}
a{color:#a78bfa;text-decoration:none}a:hover{text-decoration:underline}
footer{border-top:1px solid #0d1b2e;padding:1.4rem 2rem;text-align:center;font-size:.78rem;color:#334155}
</style>
</head>
<body>
<main>
  <h1>hookr</h1>
  <span class="tag">Node.js &middot; Express &middot; Socket.IO</span>
  <p class="lead">A real-time webhook relay that receives inbound HTTP events and fans them out to subscribed WebSocket clients. Channels are ad-hoc &mdash; any POST to <code style="color:#a78bfa;font-size:.9em">/hook/:channel</code> creates the channel on the fly. Supports event replay for clients that reconnect mid-stream.</p>

  <h2>HTTP endpoints</h2>
  <div class="row"><span class="m post">POST</span><span class="p">/hook/:channel</span><span class="d">Deliver a webhook event to a channel</span></div>
  <div class="row"><span class="m get">GET</span><span class="p">/hook/channels</span><span class="d">List all active channels</span></div>
  <div class="row"><span class="m get">GET</span><span class="p">/hook/:channel/replay</span><span class="d">Replay buffered events for a channel</span></div>
  <div class="row"><span class="m get">GET</span><span class="p">/health</span><span class="d">Health check</span></div>
  <div class="row"><span class="m ws">WS</span><span class="p">/</span><span class="d">subscribe({ channel }) to receive live events</span></div>

  <h2>Quick example</h2>
  <pre><span class="c">curl</span> -X POST https://hookr-production-882c.up.railway.app/hook/payments \
  -H <span class="s">"Content-Type: application/json"</span> \
  -d <span class="s">'{"event":"charge.succeeded","amount":4200}'</span></pre>

  <h2>Source</h2>
  <p><a href="https://github.com/nathanaellvincent/hookr">github.com/nathanaellvincent/hookr</a></p>
</main>
<footer>Built by <a href="https://vincentnathanael.com">Vincent Nathanael</a></footer>
</body>
</html>`))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// WebSocket — clients subscribe to one or more channels
io.on('connection', socket => {
  console.log(`[ws] client connected  id=${socket.id}`)

  // Client sends { channel: "payments" } or { channel: "*" }
  socket.on('subscribe', ({ channel, since } = {}) => {
    if (!channel) return socket.emit('error', { message: 'channel required' })

    const room = `channel:${channel}`
    socket.join(room)
    console.log(`[ws] ${socket.id} subscribed to ${channel}`)

    // Replay buffered events so the client catches up
    const past = replay(channel === '*' ? null : channel, since)
    if (past.length) socket.emit('replay', past)
  })

  socket.on('disconnect', () => {
    console.log(`[ws] client disconnected id=${socket.id}`)
  })
})

// Bridge EventEmitter → Socket.IO rooms
bus.on('channel:*', event => {
  io.to(`channel:${event.channel}`).emit('event', event)
  io.to('channel:*').emit('event', event)
})

const PORT = process.env.PORT ?? 3000
httpServer.listen(PORT, () => {
  console.log(`hookr listening on :${PORT}`)
  console.log(`  POST  /hook/:channel    — deliver a webhook`)
  console.log(`  GET   /hook/channels    — list active channels`)
  console.log(`  GET   /hook/:ch/replay  — replay buffered events`)
  console.log(`  WS    /                 — subscribe({ channel })`)
})
