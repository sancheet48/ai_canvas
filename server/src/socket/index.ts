import { Server, Socket } from 'socket.io';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Track presence counts for system health
let activeConnectionsCount = 0;

export function getActiveSocketConnectionsCount() {
  return activeConnectionsCount;
}

export function setupSocketIO(server: any) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Setup Redis Pub/Sub adapter if REDIS_URL is available
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    console.log('Connecting to Redis for Socket.IO adapter...');
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        console.log('Redis pub/sub connected successfully.');
        // We can use socket.io redis adapter if installed, or do simple pub/sub routing manually.
        // For simplicity and high compatibility, we can route custom Redis messages or use the adapter.
        // If we don't install the library, we can do direct event relaying via pubClient.
      })
      .catch((err) => {
        console.error('Failed to connect to Redis. Defaulting to in-memory adapter:', err);
      });
  } else {
    console.log('No REDIS_URL found. Using local in-memory socket adapter.');
  }

  io.on('connection', (socket: Socket) => {
    activeConnectionsCount++;
    console.log(`Socket connected: ${socket.id}. Total active: ${activeConnectionsCount}`);

    // Join a whiteboard board room
    socket.on('join-room', ({ boardId, userId, userName, userColor }) => {
      socket.join(boardId);
      socket.data = { boardId, userId, userName, userColor };
      
      console.log(`User ${userName} (${userId}) joined room: ${boardId}`);
      
      // Notify others in room of new user
      socket.to(boardId).emit('user-joined', {
        socketId: socket.id,
        userId,
        userName,
        userColor
      });
    });

    // Leave a board room
    socket.on('leave-room', ({ boardId }) => {
      socket.leave(boardId);
      console.log(`Socket ${socket.id} left room: ${boardId}`);
      socket.to(boardId).emit('user-left', {
        socketId: socket.id,
        userId: socket.data.userId
      });
    });

    // Broadcast cursor movements (client throttled to ~30fps)
    socket.on('cursor-move', (data: { boardId: string; x: number; y: number }) => {
      const { boardId, x, y } = data;
      socket.to(boardId).emit('cursor-update', {
        socketId: socket.id,
        userId: socket.data.userId,
        userName: socket.data.userName,
        userColor: socket.data.userColor,
        x,
        y
      });
    });

    // Yjs document state update sharing (for CRDT sync)
    socket.on('yjs-update', (data: { boardId: string; update: string }) => {
      const { boardId, update } = data;
      // Broadcast the binary/hex Yjs update to other participants in the room
      socket.to(boardId).emit('yjs-update', update);
    });

    // Full canvas sync fallback (used when Yjs is syncing or saving complete states)
    socket.on('canvas-sync', (data: { boardId: string; elements: any[] }) => {
      const { boardId, elements } = data;
      socket.to(boardId).emit('canvas-synced', elements);
    });

    socket.on('disconnect', () => {
      activeConnectionsCount--;
      console.log(`Socket disconnected: ${socket.id}. Total active: ${activeConnectionsCount}`);
      
      if (socket.data.boardId) {
        socket.to(socket.data.boardId).emit('user-left', {
          socketId: socket.id,
          userId: socket.data.userId
        });
      }
    });
  });

  return io;
}
