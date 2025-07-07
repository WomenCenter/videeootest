const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  const file = req.url === '/' ? 'index.html' : req.url;
  const ext = path.extname(file);
  const map = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css'
  };

  fs.readFile(path.join(__dirname, file), (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });
let waiting = null;
const pairs = new Map();

function pair(ws1, ws2) {
  pairs.set(ws1, ws2);
  pairs.set(ws2, ws1);
  ws1.send(JSON.stringify({ type: "match", initiator: true }));
  ws2.send(JSON.stringify({ type: "match", initiator: false }));
}

function disconnect(ws) {
  const partner = pairs.get(ws);
  if (partner && partner.readyState === WebSocket.OPEN) {
    partner.send(JSON.stringify({ type: "partner_disconnected" }));
    pairs.delete(partner);
  }
  pairs.delete(ws);
  if (waiting === ws) waiting = null;
}

wss.on('connection', ws => {
  if (waiting) {
    pair(ws, waiting);
    waiting = null;
  } else {
    waiting = ws;
    ws.send(JSON.stringify({ type: "wait" }));
  }

  ws.on('message', message => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    const partner = pairs.get(ws);
    if (partner && partner.readyState === WebSocket.OPEN) {
      if (data.type === 'skip') {
        disconnect(ws);
        if (waiting) pair(ws, waiting);
        else {
          waiting = ws;
          ws.send(JSON.stringify({ type: "wait" }));
        }
      } else if (data.type === 'reconnect') {
        disconnect(ws);
        if (waiting) pair(ws, waiting);
        else {
          waiting = ws;
          ws.send(JSON.stringify({ type: "wait" }));
        }
      } else if (data.type === 'chat') {
        partner.send(JSON.stringify({ type: 'chat', text: data.text }));
      } else {
        partner.send(JSON.stringify(data));
      }
    }
  });

  ws.on('close', () => disconnect(ws));
  ws.on('error', () => disconnect(ws));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://0.0.0.0:${PORT}`);
});
