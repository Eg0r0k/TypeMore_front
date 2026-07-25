/**
 * Match transport — the network seam for the realtime protocol (PROTOCOL.md v1).
 * `MatchTransport` is the DI contract; `WsTransport` speaks to the real server,
 * `LoopbackTransport` to an in-memory `LoopbackServer` for tests/dev.
 */
export * from './protocol'
export * from './transport'
export * from './ws-transport'
export * from './loopback'
export * from './ntp'
export * from './batcher'
