import { EventEmitter } from 'events'

// Central event bus — webhooks publish here, socket subscribers listen.
// Node's EventEmitter is the right primitive for this: it's synchronous,
// ordered, and avoids the overhead of a message broker for a single process.
const bus = new EventEmitter()
bus.setMaxListeners(0) // unbounded; each connected client adds one listener

export default bus
