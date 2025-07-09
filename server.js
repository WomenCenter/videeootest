const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? './index.html' : '.' + req.url;
  const ext = path.extname(filePath);
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css'
  };
  const contentType = types[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

const wss = new WebSocket.Server({ server });
let waiting = null;

wss.on('connection', (ws) => {
  ws.partner = null;

  const pair = (a, b) => {
    a.partner = b;
    b.partner = a;
    a.send(JSON.stringify({ type: 'match', initiator: true }));
    b.send(JSON.stringify({ type: 'match', initiator: false }));
  };

  if (waiting && waiting.readyState === WebSocket.OPEN) {
    pair(ws, waiting);
    waiting = null;
  } else {
    waiting = ws;
    ws.send(JSON.stringify({ type: 'wait' }));
  }

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'skip' || data.type === 'reconnect') {
        if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
          ws.partner.send(JSON.stringify({ type: 'partner_disconnected' }));
          ws.partner.partner = null;
        }
        ws.partner = null;
        if (waiting && waiting.readyState === WebSocket.OPEN) {
          pair(ws, waiting);
          waiting = null;
        } else {
          waiting = ws;
          ws.send(JSON.stringify({ type: 'wait' }));
        }
        return;
      }
      if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
        ws.partner.send(msg);
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
      ws.partner.send(JSON.stringify({ type: 'partner_disconnected' }));
      ws.partner.partner = null;
    }
    if (waiting === ws) {
      waiting = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur lancé sur http://0.0.0.0:${PORT}`));
