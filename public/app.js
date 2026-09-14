const socket = io();

const pairingScreen = document.getElementById('pairing-screen');
const dashboard = document.getElementById('dashboard');
const pairForm = document.getElementById('pair-form');
const phoneInput = document.getElementById('phone-input');
const pairResult = document.getElementById('pair-result');
const pairCodeEl = document.getElementById('pair-code');
const pairError = document.getElementById('pair-error');

const connectTabs = document.querySelectorAll('.connect-tab');
const viewPairing = document.getElementById('view-pairing');
const viewQr = document.getElementById('view-qr');
const qrFrame = document.getElementById('qr-frame');
const qrImage = document.getElementById('qr-image');
const btnStartQr = document.getElementById('btn-start-qr');

const chatListEl = document.getElementById('chat-list');
const chatTitleEl = document.getElementById('chat-title');
const chatSubtitleEl = document.getElementById('chat-subtitle');
const messagesEl = document.getElementById('messages');
const sendForm = document.getElementById('send-form');
const textInput = document.getElementById('text-input');
const meNumberEl = document.getElementById('me-number');
const logoutBtn = document.getElementById('logout-btn');

const URL_RE = /(https?:\/\/[^\s]+)/i;

let chats = new Map();
let activeJid = null;

// ---------- Switch tab QR / Pairing ----------

connectTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    connectTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    viewPairing.classList.toggle('active', tab.dataset.mode === 'pairing');
    viewQr.classList.toggle('active', tab.dataset.mode === 'qr');
  });
});

btnStartQr.addEventListener('click', async () => {
  pairError.hidden = true;
  btnStartQr.disabled = true;
  btnStartQr.textContent = 'Menunggu QR…';
  try {
    const res = await fetch('/api/connect-qr', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memulai QR');
  } catch (err) {
    pairError.textContent = err.message;
    pairError.hidden = false;
  } finally {
    btnStartQr.disabled = false;
    btnStartQr.textContent = 'Mulai · Tampilkan QR';
  }
});

// ---------- Pairing ----------

pairForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  pairError.hidden = true;
  const btn = pairForm.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Meminta kode…';

  try {
    const res = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneInput.value.trim() }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Gagal meminta kode');

    if (data.alreadyRegistered) {
      pairError.hidden = true;
      return; // status socket akan otomatis pindah ke dashboard
    }

    pairCodeEl.textContent = data.code;
    pairResult.hidden = false;
  } catch (err) {
    pairError.textContent = err.message;
    pairError.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Minta kode';
  }
});

// ---------- Socket events ----------

socket.on('qr', (dataUrl) => {
  qrImage.src = dataUrl;
  qrFrame.classList.add('has-image');
});

socket.on('pairing-code', (code) => {
  pairCodeEl.textContent = code;
  pairResult.hidden = false;
});

socket.on('status', ({ connected, me, error }) => {
  if (error) {
    pairError.textContent = error;
    pairError.hidden = false;
    return;
  }
  if (connected) {
    pairingScreen.hidden = true;
    dashboard.hidden = false;
    meNumberEl.textContent = me?.id?.split(':')[0] || '';
  } else {
    dashboard.hidden = true;
    pairingScreen.hidden = false;
  }
});

socket.on('chats:init', (list) => {
  chats = new Map(list.map((c) => [c.jid, c]));
  renderChatList();
});

socket.on('chat:update', ({ jid, chat }) => {
  chats.set(jid, chat);
  renderChatList();
  if (jid === activeJid) renderMessages(chat);
});

// ---------- Rendering ----------

function renderChatList() {
  chatListEl.innerHTML = '';
  const sorted = Array.from(chats.values()).sort((a, b) => {
    const ta = a.messages.at(-1)?.timestamp || 0;
    const tb = b.messages.at(-1)?.timestamp || 0;
    return tb - ta;
  });

  for (const chat of sorted) {
    const last = chat.messages.at(-1);
    const btn = document.createElement('button');
    btn.className = 'chat-item' + (chat.jid === activeJid ? ' active' : '');
    btn.innerHTML = `
      <div class="chat-item-name">${escapeHtml(chat.name)}</div>
      <div class="chat-item-preview">${escapeHtml(last?.text || '')}</div>
    `;
    btn.addEventListener('click', () => openChat(chat.jid));
    chatListEl.appendChild(btn);
  }
}

function openChat(jid) {
  activeJid = jid;
  const chat = chats.get(jid);
  chatTitleEl.textContent = chat.name;
  chatSubtitleEl.textContent = jid;
  textInput.disabled = false;
  sendForm.querySelector('button').disabled = false;
  renderChatList();
  renderMessages(chat);
}

function renderMessages(chat) {
  messagesEl.innerHTML = '';
  for (const msg of chat.messages) {
    messagesEl.appendChild(buildBubble(msg));
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function buildBubble(msg) {
  const row = document.createElement('div');
  row.className = 'bubble-row ' + (msg.fromMe ? 'out' : 'in');

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const textSpan = document.createElement('div');
  textSpan.textContent = msg.text;
  bubble.appendChild(textSpan);

  const urlMatch = msg.text?.match(URL_RE);
  if (urlMatch) {
    bubble.appendChild(buildInlineBrowser(urlMatch[1]));
  }

  if (msg.html) {
    bubble.appendChild(buildHtmlRender(msg.html));
  }

  const time = document.createElement('span');
  time.className = 'bubble-time';
  time.textContent = new Date(msg.timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit',
  });
  bubble.appendChild(time);

  row.appendChild(bubble);
  return row;
}

// Render HTML ASLI (bukan screenshot) di dalam gelembung, lewat iframe
// sandbox tanpa allow-scripts — markup & CSS tetap hidup, JS diblokir
// demi keamanan (mencegah kode .html berbahaya mengeksekusi script).
function buildHtmlRender(code) {
  const wrap = document.createElement('div');
  wrap.className = 'bubble-html-frame';

  const label = document.createElement('span');
  label.className = 'bubble-html-label';
  label.textContent = '🧩 HTML asli — dirender hidup';
  wrap.appendChild(label);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.srcdoc = `<html><body style="margin:0;font-family:sans-serif">${code}</body></html>`;
  iframe.onload = () => {
    try {
      const h = iframe.contentDocument.body.scrollHeight;
      iframe.style.height = Math.min(Math.max(h + 16, 60), 420) + 'px';
    } catch (e) {
      iframe.style.height = '160px';
    }
  };
  wrap.appendChild(iframe);
  return wrap;
}

// Fitur utama: tombol untuk membuka pratinjau browser langsung di dalam gelembung chat.
function buildInlineBrowser(url) {
  const wrapper = document.createElement('div');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'bubble-link-toggle';
  toggle.textContent = '🌐 Buka pratinjau di sini';

  let frame = null;

  toggle.addEventListener('click', () => {
    if (frame) {
      frame.remove();
      frame = null;
      toggle.textContent = '🌐 Buka pratinjau di sini';
      return;
    }

    frame = document.createElement('div');
    frame.className = 'bubble-browser';
    frame.innerHTML = `
      <div class="bubble-browser-bar">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        <span class="bubble-browser-url">${escapeHtml(url)}</span>
      </div>
    `;

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.referrerPolicy = 'no-referrer';
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';

    // Sejumlah situs mengirim header X-Frame-Options/CSP yang menolak
    // ditampilkan dalam iframe. Kalau itu terjadi, browser tidak akan
    // memicu error JS yang bisa kita tangkap, jadi kita beri fallback
    // link setelah jeda singkat sebagai jaring pengaman visual.
    frame.appendChild(iframe);
    wrapper.appendChild(frame);
    toggle.textContent = '✕ Tutup pratinjau';
  });

  wrapper.appendChild(toggle);
  return wrapper;
}

// ---------- Sending ----------

sendForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = textInput.value.trim();
  if (!text || !activeJid) return;
  textInput.value = '';

  await fetch('/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: activeJid, text }),
  });
});

logoutBtn.addEventListener('click', async () => {
  if (!confirm('Putuskan sambungan WhatsApp?')) return;
  await fetch('/api/logout', { method: 'POST' });
});

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
