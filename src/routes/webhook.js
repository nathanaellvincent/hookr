import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import bus from '../events/bus.js'
import { append, replay, channels } from '../store/eventLog.js'
import { requireApiKey } from '../middleware/auth.js'

const router = Router()

// POST /hook/:channel  — receive a webhook, fan it out to all subscribers
router.post('/:channel', requireApiKey, (req, res) => {
  const { channel } = req.params
  const event = {
    id: uuid(),
    channel,
    payload: req.body,
    receivedAt: new Date().toISOString(),
  }

  append(channel, event)
  bus.emit(`channel:${channel}`, event)
  bus.emit('channel:*', event)

  res.status(202).json({ id: event.id, channel, queued: true })
})

// GET /hook/channels  — list active channels
router.get('/channels', (req, res) => {
  res.json({ channels: channels() })
})

// GET /hook/:channel/replay?since=<ISO8601>  — replay buffered events
router.get('/:channel/replay', (req, res) => {
  const { channel } = req.params
  const since = req.query.since ?? null
  res.json({ events: replay(channel, since) })
})

export default router
