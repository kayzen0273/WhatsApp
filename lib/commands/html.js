/**
 * .html <kode-html>
 *
 * WhatsApp (aplikasi asli di HP) tidak bisa merender HTML/CSS hidup di
 * dalam chat — itu batasan WhatsApp sendiri. Jadi ke WhatsApp, bot
 * membalas kode HTML apa adanya sebagai teks/kode.
 *
 * Ke dashboard web ini, kode yang sama dikirim lewat field `html` supaya
 * dirender ASLI (bukan screenshot) di dalam gelembung chat pakai iframe.
 */
module.exports = {
  prefix: '.html',
  description: 'Kirim kode HTML — tampil hidup di dashboard, sebagai kode di WhatsApp',
  async run({ sock, from, msg, text, print }) {
    const code = text.replace(/^\.html/i, '').trim();

    if (!code) {
      await sock.sendMessage(
        from,
        { text: 'Contoh: .html <div style="padding:20px;background:#111;color:#0f0">Halo dunia</div>' },
        { quoted: msg }
      );
      return { text: '[bot] Format: .html <kode>' };
    }

    await sock.sendMessage(
      from,
      {
        text:
          '🧩 Kode HTML diterima. WhatsApp tidak bisa menampilkan HTML hidup, ' +
          'jadi ini kode aslinya — pratinjau tampilan sungguhannya bisa dilihat ' +
          'langsung di dashboard web:\n\n```' + code + '```',
      },
      { quoted: msg }
    );

    print.success(`Kode HTML diteruskan untuk dirender hidup di dashboard (${from})`);
    return { text: 'Render HTML (lihat di bawah)', html: code };
  },
};
