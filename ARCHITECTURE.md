# Whiteboard Application Architecture Documentation

This document describes the technical architecture, data schemas, sync protocols, and integrations designed for the collaborative whiteboard application.

---

## 1. System Topology Overview

The system runs as a decoupled monorepo:
- **Client App (GUI)**: React Single Page Application (Vite, TypeScript) utilizing HTML5 Canvas 2D for rendering. All drawing and interface elements are managed locally in memory via a Zustand store.
- **Server App (API)**: Express backend coordinating authentication, board metadata CRUD, social publishing, payment processing, and proxy queries to AI providers.
- **Multiplayer Hub**: Socket.IO server handling room scopes, cursor presence tags, and element document syncing.
- **Data Layers**: PostgreSQL manages users, board layout backups, stripe subscription logs, social credentials, and AI audits. Redis holds active websocket cursor presence maps.

```
       +---------------------------------------------+
       |             Vite React Client               |
       |                                             |
       |  +----------------+    +-----------------+  |
       |  | Zustand Store  |    |  Canvas Engine  |  |
       |  +-------+--------+    +--------+--------+  |
       +----------|----------------------|-----------+
                  | REST / WebSockets    | Render Loop
                  v                      v
       +---------------------------------------------+
       |           Express Server (Node.js)          |
       |                                             |
       |  +---------+   +----------+   +----------+  |
       |  | Socket  |   | AI Proxy |   |  Stripe  |  |
       |  +----+----+   +----+-----+   +----+-----+  |
       +-------|-------------|--------------|--------+
               v             v              v
         +-----------+ +-----------+  +-----------+
         | Postgres  | | Provider  |  |  Stripe   |
         | Database  | | APIs (Gem)|  | Webhooks  |
         +-----------+ +-----------+  +-----------+
```

---

## 2. Database Model Schema

The database is built on PostgreSQL with the following entity-relationship diagram:

### `users`
Tracks registered accounts and roles:
- `id` (SERIAL PRIMARY KEY)
- `email` (VARCHAR, UNIQUE)
- `password_hash` (VARCHAR)
- `role` (ENUM: `'user'`, `'admin'`)
- `verified` (BOOLEAN)
- `suspended` (BOOLEAN)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `last_login` (TIMESTAMP WITH TIME ZONE)

### `boards`
Maintains element arrays and configurations:
- `id` (UUID PRIMARY KEY)
- `owner_id` (FOREIGN KEY references `users.id`)
- `title` (VARCHAR)
- `data` (JSONB) - Serialized list of canvas elements
- `visibility` (ENUM: `'private'`, `'public'`, `'link-only'`)
- `share_token` (UUID) - Secure hash for unauthenticated reads
- `allow_comments` / `allow_fork` (BOOLEAN)
- `view_count` / `fork_count` (INTEGER)
- `created_at` / `updated_at` (TIMESTAMP WITH TIME ZONE)

### `board_members`
Collaborator bindings (Join table):
- `board_id` (UUID references `boards.id`)
- `user_id` (INTEGER references `users.id`)
- `role` (VARCHAR: `'editor'`, `'viewer'`)

### `subscriptions`
Binds user plans to Stripe:
- `user_id` (INTEGER references `users.id`, UNIQUE)
- `stripe_customer_id` (VARCHAR)
- `stripe_subscription_id` (VARCHAR)
- `plan` (ENUM: `'free'`, `'pro'`, `'team'`)
- `status` (ENUM: `'active'`, `'canceled'`, etc.)
- `current_period_end` (TIMESTAMP WITH TIME ZONE)

---

## 3. Real-time Multiplayer Coordination

Vector shapes changes sync across clients:
1. **Rooms Division**: When a client loads `/board/:id`, they transmit a `join-room` message containing `boardId` and their username metadata.
2. **Cursor Broadcasts**: Mouse coordinates capture in world space, translate to zoom offsets, and transmit via `cursor-move` events. Other clients receive `cursor-update` details and draw them with colored labels.
3. **CRDT Syncing**: Updates serialize as Yjs update buffers or JSON structures, transmitting via `canvas-sync` messages to preserve canvas synchronization.

---

## 4. AI Copilot Proxy Gateway

The backend proxy `/api/ai/chat` manages visual assistant capabilities:
1. **Context Construction**: The frontend serializes the bounding boxes, type categories, colors, and coordinates of elements on screen (`canvasContext`) and injects them alongside conversation history with every message.
2. **Provider Abstraction**: It checks credentials and routes to the user's selected provider SDK (Gemini, OpenAI, or Bedrock runtime).
3. **Canvas Elements Extraction**: The system prompt instructs the models to return vectors in a code block tagged ````canvas-elements````.
4. **Viewport Translations (Injections)**:
   The frontend parses this block, assigns unique IDs, and adjusts element layout positions:
   ```typescript
   // Calculate offsets to center elements on user's viewport
   const diagramCenterX = minX + (maxX - minX) / 2;
   const offsetX = (window.innerWidth / 2) - diagramCenterX;
   // Apply delta to coordinates
   element.x += offsetX;
   ```
   This centers the diagram inside the viewport and triggers an undo toast if rejected.

---

## 5. Security & Encryption

- **RS256 JWTs**: Verification checks utilize an RS256 key strategy. Ephemeral RSA keys self-generate on dev startup to guarantee quick setups.
- **Social token encryption**: OAuth access credentials for publishing to LinkedIn or Twitter/X are encrypted before storage:
  ```typescript
  // AES-256-CBC Encryption
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  ```

---

## 6. Admin Telemetry & Health Diagnostics

Exposes server diagnostics to the `/admin` workspace:
1. **Latency Instrumentation**: We track database query speeds in the PostgreSQL client wrapper:
   ```typescript
   const start = performance.now();
   const res = await pool.query(text, params);
   const duration = performance.now() - start;
   // store average of last 100 queries
   ```
2. **WebSockets Counter**: Active presence counts update on connection/disconnect handlers.
3. **Error logs tails**: The system logger caches the last 50 issues in memory, making debugging immediate without external monitoring configs.
