module.exports = {
  prefix: '.ping',
  description: 'Cek apakah bot masih aktif',
  async run({ sock, from, msg }) {
    const start = Date.now();
    await sock.sendMessage(from, { text: '🏓 Pong!' }, { quoted: msg });
    const ms = Date.now() - start;
    await sock.sendMessage(from, { text: `Waktu respon: ${ms}ms` });
    return { text: `[bot] Pong! (${ms}ms)` };
  },
};
