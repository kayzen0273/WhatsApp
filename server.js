const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const pino = require('pino');
const QRCode = require('qrcode');
const { Boom } = require('@hapi/boom');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const print = require('./lib/print');
const commands = require('./lib/commands');

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
let connectMode = null; // 'qr' | 'pairing'

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
  return { jid: chat.jid, name: chat.name, messages: chat.messages };
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

// mode: 'qr' | 'pairing'. phoneNumber hanya dipakai kalau mode === 'pairing'.
async function startSock(mode = connectMode || 'pairing', phoneNumber = '') {
  if (isConnecting) return sock;
  isConnecting = true;
  connectMode = mode;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    logger: pino({ level: 'silent' }),
  });

  // --- Mode pairing code (8 digit) ---
  if (mode === 'pairing' && phoneNumber && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const cleaned = phoneNumber.replace(/[^0-9]/g, '');
        const code = await sock.requestPairingCode(cleaned);
        const formatted = code.match(/.{1,4}/g)?.join('-') || code;
        print.pairingCode(formatted);
        io.emit('pairing-code', formatted);
      } catch (err) {
        print.error('Gagal minta kode pairing: ' + err.message);
        io.emit('status', { connected: false, error: err.message });
      }
    }, 1200);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && mode === 'qr') {
      const dataUrl = await QRCode.toDataURL(qr);
      io.emit('qr', dataUrl);
      print.info('QR baru dikirim ke dashboard.');
    }

    if (connection === 'open') {
      isConnected = true;
      isConnecting = false;
      const number = sock.user?.id?.split(':')[0] || '?';
      print.connected(number);
      io.emit('status', { connected: true, me: sock.user });
    }

    if (connection === 'close') {
      isConnected = false;
      isConnecting = false;
      const statusCode = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output.statusCode
        : null;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      print.warn(`Koneksi terputus (${statusCode || 'unknown'}). ${loggedOut ? 'Perlu login ulang.' : 'Mencoba menyambung lagi...'}`);
      io.emit('status', { connected: false, loggedOut });

      if (!loggedOut) {
        setTimeout(() => startSock(mode, phoneNumber), 2000);
      }
    }
  });

  // --- Pesan masuk: simpan ke histori + jalankan command kalau cocok ---
  // Command dicek untuk SEMUA pesan (termasuk yang kamu kirim sendiri dari
  // nomor yang tersambung) supaya kamu bisa uji coba command langsung dari
  // HP kamu sendiri, bukan cuma dari nomor orang lain.
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return; // abaikan sinkronisasi riwayat lama saat reconnect

    for (const msg of messages) {
      if (!msg.message) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid === 'status@broadcast') continue;

      const text = extractText(msg);
      const fromMe = !!msg.key.fromMe;

      pushMessage(jid, {
        id: msg.key.id,
        fromMe,
        text,
        timestamp: Number(msg.messageTimestamp) * 1000 || Date.now(),
      });

      const prefix = text.trim().split(/\s+/)[0]?.toLowerCase();
      const cmd = Object.values(commands).find((c) => c.prefix === prefix);

      if (cmd) {
        print.command(jid, prefix);
        try {
          const result = await cmd.run({ sock, from: jid, msg, text, print });
          pushMessage(jid, {
            id: `bot-${Date.now()}`,
            fromMe: true,
            text: result?.text || `[bot menjalankan ${prefix}]`,
            html: result?.html, // kalau ada, dashboard merender ini sebagai HTML hidup
            timestamp: Date.now(),
          });
        } catch (err) {
          print.error(`Command ${prefix} gagal: ${err.message}`);
        }
      }
    }
  });

  isConnecting = false;
  return sock;
}

// --- REST API ---

// Mulai koneksi lewat QR. QR gambarnya dikirim lewat event socket 'qr'.
app.post('/api/connect-qr', async (req, res) => {
  try {
    if (sock?.authState?.creds?.registered) return res.json({ alreadyRegistered: true });
    await startSock('qr');
    res.json({ ok: true });
  } catch (err) {
    print.error('Gagal mulai QR: ' + err.message);
    res.status(500).json({ error: err.message || 'Gagal memulai QR' });
  }
});

// Minta kode pairing 8 digit untuk nomor tertentu.
// Body: { phoneNumber: "62812xxxxxxx" } (format internasional tanpa '+' atau '00')
app.post('/api/pair', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber wajib diisi (format 62xxxxxxxxxx)' });
    }

    if (!sock) await startSock('pairing', phoneNumber);

    if (sock.authState.creds.registered) {
      return res.json({ alreadyRegistered: true });
    }

    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    const code = await sock.requestPairingCode(cleaned);
    const formatted = code.match(/.{1,4}/g)?.join('-') || code;
    print.pairingCode(formatted);
    res.json({ code: formatted, raw: code });
  } catch (err) {
    print.error('Gagal minta pairing code: ' + err.message);
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

    pushMessage(jid, { id: `local-${Date.now()}`, fromMe: true, text, timestamp: Date.now() });

    res.json({ ok: true });
  } catch (err) {
    print.error('Gagal kirim pesan: ' + err.message);
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
  print.banner(PORT);
  // Coba pulihkan sesi lama (kalau sudah pernah login sebelumnya) tanpa
  // memaksa munculnya QR/pairing baru.
  startSock();
});
