![Logo](preview.png)

# TypeMore

TypeMore is a modern web application for testing and improving typing skills. The project offers an interactive interface for touch typing practice, competing with friends, and tracking progress.

## Key Features

- **Multiple Test Modes**:
  - Time Mode
  - Word Count Mode
  - Free Mode - `in DEV`
  - Custom Text Mode - `in DEV`

- **Personalization**:
  - Customizable Themes
  - Interface Language Selection
  - Font Size Adjustment
  - Sound Effects

- **Statistics and Analytics**:
  - Typing Speed (WPM)
  - Accuracy
  - Result History
  - Detailed Error Statistics

## Tech Stack

### Frontend

- **Framework**: Vue 3
- **State Management**: Pinia
- **Routing**: Vue Router
- **Styling**: SCSS
- **Language**: TypeScript
- **Build Tool**: Vite
- **Form Validation**: Vee-validate

### Backend

- **Language**: Golang

## Base Colors

| Name              | Hex     | Preview                                                  |
| ----------------- | ------- | -------------------------------------------------------- |
| Main color        | #528bff | ![#528bff](https://via.placeholder.com/10/528bff?text=+) |
| Background color  | #121212 | ![#121212](https://via.placeholder.com/10/121212?text=+) |
| Sub alt color     | #1c1c1c | ![#1c1c1c](https://via.placeholder.com/10/1c1c1c?text=+) |
| Sub color         | #3a3a3a | ![#3a3a3a](https://via.placeholder.com/10/3a3a3a?text=+) |
| Text color        | #eeeeee | ![#eeeeee](https://via.placeholder.com/10/eeeeee?text=+) |
| Error color       | #da3333 | ![#da3333](https://via.placeholder.com/10/da3333?text=+) |
| Extra error color | #791717 | ![#791717](https://via.placeholder.com/10/791717?text=+) |

## Local Development

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn
- Git

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Eg0r0k/TypeMore_front.git
```

2. Navigate to the project directory:

```bash
cd TypeMore_front
```

3. Install dependencies:

```bash
npm install
```

4. Start the development server:

```bash
npm run dev
```

## Backend Integration & Environment

### `VITE_API_URL`

The frontend talks to the Go backend exclusively through the shared API layer
(`src/shared/api/`), which reads its base URL from the `VITE_API_URL` environment
variable. This is the **only** place the API origin is configured — the base URL
is **never hardcoded** in source; `transport.ts` and `endpoints.ts` both derive
every request from `import.meta.env.VITE_API_URL`.

- The value must include the API prefix, e.g. `http://localhost:8080/api/v1`.
- Copy `.env.example` to `.env` and adjust as needed:
  ```bash
  cp .env.example .env
  ```
- **Port-8080 caveat:** docker-compose exposes the backend on `:8080`. On some
  machines a system proxy (or another service) shadows port `8080`. If requests
  fail to connect, remap the backend to a free host port in compose and point
  `VITE_API_URL` at that mapped port instead (the prefix stays `/api/v1`).

### `VITE_TURNSTILE_SITE_KEY`

Cloudflare Turnstile site key. It guards the three abuse-prone auth endpoints —
`POST /auth/register`, `POST /auth/password-reset/request` and
`POST /auth/verify/resend` — by adding a `turnstileToken` field to their JSON
bodies.

- **Absent or blank is the dev default**, and it disables the captcha entirely:
  Cloudflare's script is never fetched, no widget renders, and the request
  bodies are byte-identical to their pre-captcha form.
- It mirrors the backend's `TYPEMORE_TURNSTILE_SECRET`, which disables
  verification when empty. Set both or neither: a site key pointed at a backend
  with no secret only makes users solve a challenge nobody checks.
- The script is loaded lazily by the widget, so it reaches auth routes only —
  the typing test and the boards never pay for it.
- The backend answers a bad or missing token with HTTP 400 `captcha_failed` /
  `captcha_required`. Both surface the same message and reset the widget, since
  a Turnstile token is single-use.

### Developing against docker-compose

Run the backend stack from the `TypeMore_back` repository, then run this
frontend's dev server against it:

```bash
# In TypeMore_back:
docker compose up -d          # Go API on :8080, Postgres, and Mailpit

# In TypeMore_front:
cp .env.example .env          # VITE_API_URL -> http://localhost:8080/api/v1
pnpm install
pnpm dev                      # Vite dev server (default http://localhost:5173)
```

The dev server proxies nothing — the browser calls `VITE_API_URL` directly, so
the backend must permit the dev origin via CORS (compose config handles this).

### Manual smoke test (full auth + run flow)

Verifies the end-to-end path an integration exercises: register → email verify →
login → play → run persisted. Requires the compose stack up (API + Mailpit).

1. **Bring up the backend:** `docker compose up -d` in `TypeMore_back`. Confirm
   the API answers on `VITE_API_URL` and Mailpit's web UI is reachable (default
   `http://localhost:8025`).
2. **Register via the UI:** start `pnpm dev`, open the app, go to **Login →
   Create one**, and submit a display name, email, and password. The form calls
   `POST /auth/register` and shows "Check your email to verify your address."
3. **Verify via Mailpit:** open the Mailpit inbox (`http://localhost:8025`), open
   the verification email, and click its link. It opens the app's `/verify`
   route (`POST /auth/verify`) and confirms "Your email is verified."
4. **Login:** from **Login**, sign in with the same credentials
   (`POST /auth/login`). The header now shows your display name (the account
   dropdown), confirming `/me` resolved the session to `authed`.
5. **Play a run:** on `/`, keep a ranked-eligible mode (words or time — the
   defaults) and complete a run. On the results screen the save hint reads
   "saved · pending validation" (`POST /runs`), NOT "sign in to save".
6. **Confirm persistence:** the finished run now appears in the account's run
   list served by `GET /runs` (used by the results/history query layer). Fetching
   `GET {VITE_API_URL}/runs` for the logged-in session returns the run.

> A signed-out (guest) visitor at step 5 instead sees a subtle **"sign in to
> save"** link and no `POST /runs` is issued — covered by the
> `e2e/guest-save-hint.spec.ts` Playwright spec.

### Playing online (multiplayer dev)

Multiplayer runs over a WebSocket at `/ws` (wire protocol v1, see
`docs/PROTOCOL.md`). The endpoint is resolved from `VITE_WS_URL` if set, else
derived from `VITE_API_URL` (its origin + `/ws`).

**With the real backend:**

1. Start the typemore-server from its own repository (e.g. its docker compose)
   so the WS endpoint is reachable.
2. Point `.env` at it — `VITE_WS_URL` (or just `VITE_API_URL`) — and run
   `pnpm dev`.
3. Open the app in **two** browser tabs. In tab A go to **Servers → Create
   room** and share the 6-character room code; in tab B use **Join by code**.
4. Tab B readies up, tab A (the host) starts the match: countdown, race,
   standings.

**Without a backend (loopback mode):**

`pnpm dev`, then open `/servers?mp=loopback`. The page runs a full in-page
fake server — create a room, then seat fake opponents from the devtools
console:

```js
window.__tmLoopback.addBot() // joins, readies up, and races (optional { wpm })
```

> Match runs are captured **server-side** — the client never `POST`s them to
> `/runs`. Solo runs keep the submission flow described above.

## Project Structure

```
src/
├── app/            # Application configuration
├── entities/       # Business entities
├── features/       # Feature modules
├── pages/          # Application pages
├── shared/         # Shared components and utilities
└── widgets/        # Composite components
```

## Contributing

We welcome contributions to the project! If you'd like to help:

1. Fork the repository
2. Create a branch for your changes
3. Make your changes
4. Submit a Pull Request

## Development Roadmap

- [ ] Add new testing modes
- [ ] Improve speed calculation algorithm
- [ ] Social media integration
- [x] Mobile version
- [ ] Offline mode

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Authors

- [@Eg0r0k](https://github.com/Eg0r0k) - Development and Design

---

Made with ❤️
