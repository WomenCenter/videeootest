const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  const filePath = req.url === '/' ? './index.html' : '.' + req.url;
  const ext = path.extname(filePath).toLowerCase();
  const typeMap = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': typeMap[ext] || 'text/plain' });
      res.end(data);
    }
  });
});

const wss = new WebSocket.Server({ server });
let waiting = null;

wss.on('connection', (ws) => {
  ws.partner = null;

  function send(to, msg) {
    if (to && to.readyState === WebSocket.OPEN) {
      to.send(JSON.stringify(msg));
    }
  }

  if (waiting && waiting.readyState === WebSocket.OPEN) {
    ws.partner = waiting;
    waiting.partner = ws;
    send(ws, { type: "match", initiator: true });
    send(waiting, { type: "match", initiator: false });
    waiting = null;
  } else {
    waiting = ws;
    send(ws, { type: "wait" });
  }

  ws.on('message', (msg) => {
    if (ws.partner) send(ws.partner, JSON.parse(msg));
  });

  ws.on('close', () => {
    if (ws.partner) {
      send(ws.partner, { type: "partner_disconnected" });
      ws.partner.partner = null;
    }
    if (waiting === ws) waiting = null;
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("Serveur lancé sur http://0.0.0.0:" + PORT);
});
