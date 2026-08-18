const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // REQUIRED for split hosting

const app = express();

// 1. Allow Express CORS
app.use(cors()); 

const server = http.createServer(app);

// 2. Allow Socket.IO CORS
const io = new Server(server, {
    maxHttpBufferSize: 1e8,
    cors: {
        origin: "*", // IN PRODUCTION: Change this to your actual Netlify URL (e.g., "https://my-board.netlify.app")
        methods: ["GET", "POST"]
    }
});

// Basic health check route
app.get('/', (req, res) => {
    res.send('Socket.IO Collaborative Board Server is running!');
});

// Format: { 'roomId': count }
const roomUsers = {};

io.on('connection', (socket) => {
    // ... (Keep all your existing socket logic exactly the same) ...
    
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId;

        if (!roomUsers[roomId]) roomUsers[roomId] = 0;
        roomUsers[roomId]++;

        console.log(`User ${socket.id} joined room [${roomId}] | Total users: ${roomUsers[roomId]}`);
        io.to(roomId).emit('user_count', roomUsers[roomId]);
    });

    const broadcastToRoom = (event, data) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit(event, data);
        }
    };

    socket.on('draw_line', (data) => broadcastToRoom('draw_line', data));
    socket.on('draw_shape', (data) => broadcastToRoom('draw_shape', data));
    socket.on('draw_text', (data) => broadcastToRoom('draw_text', data));
    socket.on('add_image', (data) => broadcastToRoom('add_image', data));
    socket.on('update_image', (data) => broadcastToRoom('update_image', data));
    socket.on('delete_image', (id) => broadcastToRoom('delete_image', id));
    socket.on('add_sticky', (data) => broadcastToRoom('add_sticky', data));
    socket.on('update_sticky', (data) => broadcastToRoom('update_sticky', data));
    socket.on('delete_sticky', (id) => broadcastToRoom('delete_sticky', id));

    socket.on('cursor_move', (data) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('cursor_move', { id: socket.id, x: data.x, y: data.y });
        }
    });

    socket.on('clear_board', () => broadcastToRoom('clear_board'));

    socket.on('disconnect', () => {
        if (socket.roomId) {
            const roomId = socket.roomId;
            roomUsers[roomId]--;
            console.log(`User ${socket.id} disconnected from room [${roomId}] | Total users: ${roomUsers[roomId]}`);
            
            io.to(roomId).emit('user_count', roomUsers[roomId]);
            socket.to(roomId).emit('user_disconnected', socket.id);

            if (roomUsers[roomId] <= 0) {
                delete roomUsers[roomId];
                console.log(`Room [${roomId}] is empty and has been removed from memory.`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
