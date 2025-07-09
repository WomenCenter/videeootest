const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  const filePath = req.url === '/' ? './index.html' : `.${req.url}`;
  const extname = path.extname(filePath);
  const contentType = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
  }[extname] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

const wss = new WebSocket.Server({ server });

let waiting = null;

wss.on('connection', socket => {
  socket.on('message', msg => {
    try {
      const data = JSON.parse(msg);

      if (data.offer || data.answer || data.candidate) {
        socket.partner?.send(msg);
      }

      if (data.type === 'skip' || data.type === 'reconnect') {
        if (socket.partner) {
          socket.partner.partner = null;
          socket.partner.send(JSON.stringify({ type: 'partner_disconnected' }));
        }
        socket.partner = null;
        match(socket);
      }
    } catch (e) {
      console.error("Message parsing error:", e);
    }
  });

  socket.on('close', () => {
    if (socket.partner) {
      socket.partner.partner = null;
      socket.partner.send(JSON.stringify({ type: 'partner_disconnected' }));
    }
    if (waiting === socket) waiting = null;
  });

  match(socket);
});

function match(socket) {
  if (waiting && waiting.readyState === WebSocket.OPEN) {
    socket.partner = waiting;
    waiting.partner = socket;

    socket.send(JSON.stringify({ type: 'match', initiator: true }));
    waiting.send(JSON.stringify({ type: 'match', initiator: false }));

    waiting = null;
  } else {
    waiting = socket;
    socket.send(JSON.stringify({ type: 'wait' }));
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://0.0.0.0:${PORT}`);
});
