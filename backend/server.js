const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve static frontend files in production
// Works both when run from root (node backend/server.js) or from backend folder
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
console.log('Serving static files from:', publicPath);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Track rooms and their participants
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    const room = rooms.get(roomId) || [];
    
    // Only allow 2 people per room for 1-1 calls
    if (room.length >= 2) {
      socket.emit('room-full');
      return;
    }

    room.push(socket.id);
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.roomId = roomId;

    console.log(`User ${socket.id} joined room ${roomId}. Room size: ${room.length}`);

    // Notify the new user about existing participant
    const otherUser = room.find(id => id !== socket.id);
    if (otherUser) {
      socket.emit('other-user', otherUser);
      socket.to(otherUser).emit('user-joined', socket.id);
    }
  });

  socket.on('offer', ({ to, offer }) => {
    socket.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    socket.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    socket.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomId) {
      const room = rooms.get(socket.roomId) || [];
      const updatedRoom = room.filter(id => id !== socket.id);
      
      if (updatedRoom.length === 0) {
        rooms.delete(socket.roomId);
      } else {
        rooms.set(socket.roomId, updatedRoom);
        // Notify remaining user
        socket.to(socket.roomId).emit('user-left');
      }
    }
  });
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Svoi server running on port ${PORT}`);
});
