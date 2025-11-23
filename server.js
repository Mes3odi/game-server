const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const players = {};
const chatHistory = [];

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

    ws.send(JSON.stringify({
        type: 'init',
        players: players,
        chatHistory: chatHistory.slice(-50)
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch(data.type) {
                case 'join':
                    playerId = data.id;
                    players[playerId] = data.player;
                    broadcast({
                        type: 'playerJoined',
                        id: playerId,
                        player: data.player
                    });
                    break;

                case 'update':
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
                    const chatMsg = {
                        type: 'chat',
                        author: data.author,
                        message: data.message,
                        color: data.color,
                        timestamp: Date.now()
                    };
                    chatHistory.push(chatMsg);
                    if (chatHistory.length > 100) {
                        chatHistory.shift();
                    }
                    broadcast(chatMsg);
                    break;
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    ws.on('close', () => {
        if (playerId && players[playerId]) {
            delete players[playerId];
            broadcast({
                type: 'playerLeft',
                id: playerId
            });
        }
    });
});

app.get('/', (req, res) => {
    res.send('Game server running! Players: ' + Object.keys(players).length);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server on port ${PORT}`);
});
