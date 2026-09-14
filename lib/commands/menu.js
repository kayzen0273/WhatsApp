module.exports = {
  prefix: '.menu',
  description: 'Tampilkan daftar command',
  async run({ sock, from, msg }) {
    const registry = require('./index');
    const list = Object.values(registry)
      .map((c) => `• ${c.prefix} — ${c.description}`)
      .join('\n');
    await sock.sendMessage(from, { text: `📋 *Daftar Command*\n\n${list}` }, { quoted: msg });
    return { text: '[bot] Menu dikirim.' };
  },
};
