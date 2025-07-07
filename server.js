const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
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

server.listen(3000, () => {
  console.log("Serveur lancé sur http://localhost:3000");
});
