const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  fs.readFile('index.html', (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end("Erreur serveur");
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

let waiting = null;

wss.on('connection', (ws) => {
  ws.partner = null;

  if (waiting === null) {
    waiting = ws;
    ws.send(JSON.stringify({ type: "wait" }));
  } else {
    ws.partner = waiting;
    waiting.partner = ws;

    ws.send(JSON.stringify({ type: "match", initiator: true }));
    waiting.send(JSON.stringify({ type: "match", initiator: false }));

    waiting = null;
  }

  ws.on('message', (msg) => {
    if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
      ws.partner.send(msg);
    }
  });

  ws.on('close', () => {
    if (waiting === ws) waiting = null;
    if (ws.partner) {
      ws.partner.send(JSON.stringify({ type: "partner_disconnected" }));
      ws.partner.partner = null;
    }
  });
});

server.listen(3000, () => {
  console.log("Serveur lancé sur http://localhost:3000");
});
