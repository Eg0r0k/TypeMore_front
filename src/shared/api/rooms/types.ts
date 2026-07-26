/**
 * Layer 1 — Room list request types.
 *
 * `GET /rooms` takes no parameters: the server decides what "open" means and
 * what order busiest-first is, and a client-side filter would only be a second,
 * disagreeing opinion. So the only type here is the one the RESPONSE cannot
 * express: which of the two mutually-exclusive dimension fields is real.
 */

/**
 * The dimension a room's mode gives it, as something a view can switch on.
 *
 * `RoomListSettings` carries `durationMs` and `wordCount` as two independent
 * optionals because that is the wire shape; this is the same fact with the
 * exclusivity moved into the type, so that reading the wrong one is a compile
 * error rather than a `0` on screen.
 */
export type RoomDimension =
  | { readonly kind: 'time'; readonly durationMs: number }
  | { readonly kind: 'words'; readonly wordCount: number }
