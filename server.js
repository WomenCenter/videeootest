const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  let file = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(__dirname, file);
  let ext = path.extname(filePath).toLowerCase();

  const contentType = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css'
  }[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

const wss = new WebSocket.Server({ server });

let waiting = null;

wss.on('connection', socket => {
  socket.partner = null;

  if (waiting) {
    socket.partner = waiting;
    waiting.partner = socket;
    waiting.send(JSON.stringify({ type: 'match', initiator: true }));
    socket.send(JSON.stringify({ type: 'match', initiator: false }));
    waiting = null;
  } else {
    waiting = socket;
    socket.send(JSON.stringify({ type: 'wait' }));
  }

  socket.on('message', msg => {
    if (socket.partner && socket.partner.readyState === WebSocket.OPEN) {
      socket.partner.send(msg);
    }
  });

  socket.on('close', () => {
    if (socket.partner && socket.partner.readyState === WebSocket.OPEN) {
      socket.partner.send(JSON.stringify({ type: 'partner_disconnected' }));
      socket.partner.partner = null;
    }

    if (waiting === socket) {
      waiting = null;
    }
  });
});

const port = process.env.PORT || 10000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Serveur lancé sur http://0.0.0.0:${port}`);
});
