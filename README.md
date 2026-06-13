# Collaborative Whiteboard App (Monorepo)

A full-stack collaborative whiteboard application (inspired by Excalidraw) featuring a hand-drawn infinite canvas engine, real-time multiplayer editing (Socket.IO + Yjs synchronization), multi-provider AI visual copilot (supporting OpenAI, Google Gemini, and AWS Bedrock), Stripe pricing plans, social network publishing, and an interactive system admin dashboard.

---

## Folder Structure

```
├── client/              # React + TypeScript + Vite + Tailwind CSS Frontend
│   ├── src/
│   │   ├── canvas/      # Canvas 2D render loops & coordinates transforms
│   │   ├── components/  # Floating toolbar, style context, AI chats & sharing modals
│   │   ├── store/       # Zustand auth & canvas state managers
│   │   └── pages/       # Workspace canvas, explore catalog, dashboard console
├── server/              # Node.js + Express + Socket.IO Backend Server
│   ├── src/
│   │   ├── db/          # PostgreSQL connector pools, migrations & seeding
│   │   ├── middleware/  # JWT & role verification filters
│   │   ├── routes/      # Auth, Boards, AI proxy, Stripe billing, Social linkings
│   │   └── socket/      # WebSocket multiplayer presence listeners
├── package.json         # Workspace orchestration config
```

---

## Prerequisites

Ensure you have the following installed on your local machine:
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **PostgreSQL** database instance
- **Redis** server instance (Optional, falls back to memory if unconfigured)

---

## Installation & Setup

1. **Clone & Navigate** to the project folder:
   ```bash
   cd APP_1
   ```

2. **Install Workspace Dependencies**:
   Install root orchestrator dependencies:
   ```bash
   npm install
   ```

3. **Install Component Modules**:
   Install frontend and backend libraries:
   ```bash
   npm run dev:install # (or npm install --prefix client && npm install --prefix server)
   ```

---

## Environment Variables Configuration

Create a `.env` file in the `/server` directory:

```env
# Server & Client Bindings
PORT=5000
SERVER_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173

# Database & Cache Connection Strings
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whiteboard
REDIS_URL=redis://localhost:6379

# Cryptography Security Secrets
JWT_PRIVATE_KEY=""                  # Ephemeral RSA keys self-generate if empty
JWT_PUBLIC_KEY=""
ENCRYPTION_KEY="whiteboard-secret-key-for-encryption-aes-256-bit"

# Email Delivery Credentials
RESEND_API_KEY=""
FROM_EMAIL="onboarding@resend.dev"

# Stripe Pricing Products
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_PRO="price_mock_pro_123"
STRIPE_PRICE_TEAM="price_mock_team_456"

# AI Assistant Models API Keys
OPENAI_API_KEY=""
GOOGLE_GENERATIVE_AI_API_KEY=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="us-east-1"
BEDROCK_MODEL_ID="anthropic.claude-3-5-sonnet-20240620-v1:0"

# Social Media API Linkings
LINKEDIN_CLIENT_ID=""
LINKEDIN_CLIENT_SECRET=""
TWITTER_CLIENT_ID=""
TWITTER_CLIENT_SECRET=""

# Admin Default Seed Credentials
ADMIN_SEED_EMAIL=admin@whiteboard.app
ADMIN_SEED_PASSWORD=AdminPassword123!
```

---

## Running the Application

### 🚀 Starting Dev Server & Client GUI Concurrently
Run both the Express server on port 5000 and the Vite frontend application on port 5173 concurrently using the root pipeline script:
```bash
npm run dev
```
Once booted, visit **`http://localhost:5173`** in your browser.

### 👥 Seeding the Default Admin User
To seed the initial administrative account to inspect the system health stats and override subscriptions:
```bash
npm run seed:admin
```
Log in using:
- **Email**: `admin@whiteboard.app`
- **Password**: `AdminPassword123!`

### 🧪 Running Individual Components
If you wish to spin up frontend or backend services separately:
- **Start Backend Node Server Only**:
  ```bash
  npm run dev:server
  ```
- **Start Frontend React Client Only**:
  ```bash
  npm run dev:client
  ```
