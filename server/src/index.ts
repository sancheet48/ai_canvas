import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { runMigrations } from './db/migrate';
import { seedAdmin } from './db/seed';
import authRouter from './routes/auth';
import boardsRouter from './routes/boards';
import aiRouter from './routes/ai';
import stripeRouter from './routes/stripe';
import adminRouter from './routes/admin';
import { setupSocketIO } from './socket';

dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS options
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: clientOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Base health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Mounting routers
app.use('/api/auth', authRouter);
app.use('/api/boards', boardsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/admin', adminRouter);

// Set up Socket.IO
setupSocketIO(server);

// Boot server after running DB migrations & seeding admin
const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    // Run DB migrations
    await runMigrations();
    
    // Seed default admin
    await seedAdmin();

    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 Whiteboard server listening on port ${PORT}`);
      console.log(`🌍 Client origin authorized: ${clientOrigin}`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('Fatal crash during server bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();
