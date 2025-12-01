const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // This allows any website to connect (easier for development)
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Player disconnected');
  });
});

// This line is key for Railway later!
// It looks for a specific environment port, or defaults to 3001
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});