// In-memory circular buffer of the last N events per channel.
// Lets new WebSocket clients replay missed events on connect.

const MAX_EVENTS = 100

/** @type {Map<string, Array<{id:string, channel:string, payload:any, receivedAt:string}>>} */
const log = new Map()

export function append(channel, event) {
  if (!log.has(channel)) log.set(channel, [])
  const buf = log.get(channel)
  buf.push(event)
  if (buf.length > MAX_EVENTS) buf.shift()
}

export function replay(channel, since) {
  const buf = log.get(channel) ?? []
  if (!since) return buf
  return buf.filter(e => e.receivedAt > since)
}

export function channels() {
  return [...log.keys()]
}
