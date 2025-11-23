// Install dependencies: npm install ws express
const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store all connected players
const players = {};
const chatHistory = [];

// Broadcast to all connected clients
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

wss.on('connection', (ws) => {
    console.log('New player connected');
    let playerId = null;

    // Send existing players and chat history to new player
    ws.send(JSON.stringify({
        type: 'init',
        players: players,
        chatHistory: chatHistory.slice(-50) // Last 50 messages
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch(data.type) {
                case 'join':
                    // New player joined
                    playerId = data.id;
                    players[playerId] = data.player;
                    broadcast({
                        type: 'playerJoined',
                        id: playerId,
                        player: data.player
                    });
                    console.log(`Player ${playerId} joined`);
                    break;

                case 'update':
                    // Player position/state update
                    if (playerId && players[playerId]) {
                        players[playerId] = { ...players[playerId], ...data.player };
                        broadcast({
                            type: 'playerUpdate',
                            id: playerId,
                            player: players[playerId]
                        });
                    }
                    break;

                case 'chat':
                    // Chat message
                    const chatMsg = {
                        type: 'chat',
                        author: data.author,
                        message: data.message,
                        color: data.color,
                        timestamp: Date.now()
                    };
                    chatHistory.push(chatMsg);
                    if (chatHistory.length > 100) {
                        chatHistory.shift(); // Keep only last 100 messages
                    }
                    broadcast(chatMsg);
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        if (playerId && players[playerId]) {
            console.log(`Player ${playerId} disconnected`);
            delete players[playerId];
            broadcast({
                type: 'playerLeft',
                id: playerId
            });
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Health check endpoint
app.get('/', (req, res) => {
    res.send('Game server is running! Players online: ' + Object.keys(players).length);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
