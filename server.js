const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const AUTH_DIR = path.join(__dirname, 'auth_info');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

let sock = null;
let isConnected = false;
let isConnecting = false;

// Menyimpan histori pesan sederhana di memori (untuk demo). Untuk produksi,
// ganti dengan database (SQLite/Postgres/dst).
const chats = new Map(); // jid -> { name, messages: [] }

function pushMessage(jid, message) {
  if (!chats.has(jid)) {
    chats.set(jid, { jid, name: jid.split('@')[0], messages: [] });
  }
  const chat = chats.get(jid);
  chat.messages.push(message);
  if (chat.messages.length > 200) chat.messages.shift();
  io.emit('chat:update', { jid, chat: serializeChat(chat) });
}

function serializeChat(chat) {
  return {
    jid: chat.jid,
    name: chat.name,
    messages: chat.messages,
  };
}

function extractText(msg) {
  if (!msg.message) return '';
  return (
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    ''
  );
}

async function startSock() {
  if (isConnecting) return sock;
  isConnecting = true;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      isConnected = true;
      isConnecting = false;
      io.emit('status', { connected: true, me: sock.user });
    }

    if (connection === 'close') {
      isConnected = false;
      isConnecting = false;
      const statusCode = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output.statusCode
        : null;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      io.emit('status', { connected: false, loggedOut });

      if (!loggedOut) {
        // Coba sambung ulang otomatis, kecuali memang logout manual.
        setTimeout(() => startSock(), 2000);
      }
    }
  });

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid === 'status@broadcast') continue;

      const text = extractText(msg);
      pushMessage(jid, {
        id: msg.key.id,
        fromMe: !!msg.key.fromMe,
        text,
        timestamp: Number(msg.messageTimestamp) * 1000 || Date.now(),
      });
    }
  });

  isConnecting = false;
  return sock;
}

// --- REST API ---

// Minta kode pairing 8 digit untuk nomor tertentu.
// Body: { phoneNumber: "62812xxxxxxx" } (format internasional tanpa '+' atau '00')
app.post('/api/pair', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber wajib diisi (format 62xxxxxxxxxx)' });
    }

    if (!sock) await startSock();

    if (sock.authState.creds.registered) {
      return res.json({ alreadyRegistered: true });
    }

    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    const code = await sock.requestPairingCode(cleaned);
    // Baileys mengembalikan string tanpa format, kita rapikan jadi XXXX-XXXX
    const formatted = code.match(/.{1,4}/g)?.join('-') || code;
    res.json({ code: formatted, raw: code });
  } catch (err) {
    console.error('Gagal minta pairing code:', err);
    res.status(500).json({ error: err.message || 'Gagal meminta pairing code' });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ connected: isConnected, me: sock?.user || null });
});

app.get('/api/chats', (req, res) => {
  res.json(Array.from(chats.values()).map(serializeChat));
});

// Kirim pesan teks. Body: { to: "62812xxxxxxx@s.whatsapp.net", text: "..." }
app.post('/api/send', async (req, res) => {
  try {
    const { to, text } = req.body;
    if (!sock || !isConnected) return res.status(409).json({ error: 'Belum terhubung ke WhatsApp' });

    const jid = to.includes('@') ? to : `${to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });

    pushMessage(jid, {
      id: `local-${Date.now()}`,
      fromMe: true,
      text,
      timestamp: Date.now(),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Gagal kirim pesan:', err);
    res.status(500).json({ error: err.message || 'Gagal mengirim pesan' });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    if (sock) await sock.logout();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  socket.emit('status', { connected: isConnected, me: sock?.user || null });
  socket.emit('chats:init', Array.from(chats.values()).map(serializeChat));
});

server.listen(PORT, () => {
  console.log(`WA Dashboard jalan di http://localhost:${PORT}`);
  startSock();
});
