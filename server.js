const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// Crée le serveur HTTP et sert le fichier HTML
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Erreur interne serveur');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else {
    res.writeHead(404);
    res.end('404 Not Found');
  }
});

// Initialise le WebSocket Server
const wss = new WebSocket.Server({ server });

let queue = [];
let pairs = new Map();

function pairUsers() {
  while (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();

    pairs.set(a, b);
    pairs.set(b, a);

    a.send(JSON.stringify({ type: "match", initiator: true }));
    b.send(JSON.stringify({ type: "match", initiator: false }));
  }
}

function removeFromQueue(ws) {
  queue = queue.filter(client => client !== ws);
}

wss.on('connection', ws => {
  ws.isAlive = true;

  ws.on('message', message => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return;
    }

    const target = pairs.get(ws);

    if (data.offer || data.answer || data.candidate) {
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify(data));
      }
    }

    if (data.type === "skip" || data.type === "reconnect") {
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify({ type: "partner_disconnected" }));
      }
      pairs.delete(ws);
      pairs.delete(target);
      queue.push(ws);
      pairUsers();
    }
  });

  ws.on('close', () => {
    const partner = pairs.get(ws);
    if (partner && partner.readyState === WebSocket.OPEN) {
      partner.send(JSON.stringify({ type: "partner_disconnected" }));
      queue.push(partner);
    }
    removeFromQueue(ws);
    pairs.delete(ws);
    pairs.delete(partner);
    pairUsers();
  });

  queue.push(ws);
  ws.send(JSON.stringify({ type: "wait" }));
  pairUsers();
});

// Démarre le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur lancé sur http://0.0.0.0:${PORT}`);
});
