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
