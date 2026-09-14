const { downloadMediaMessage } = require('@whiskeysockets/baileys');

/**
 * .rvo -> di-reply ke pesan "Lihat sekali" (foto/video/voice note).
 * Bot mengunduh medianya lalu mengirim ulang sebagai pesan biasa.
 */
module.exports = {
  prefix: '.rvo',
  description: "Buka ulang foto/video/vn 'Lihat sekali' yang di-reply",
  async run({ sock, from, msg, print }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
      await sock.sendMessage(from, { text: 'Reply pesan *Lihat sekali* dengan caption .rvo ya.' }, { quoted: msg });
      return { text: '[bot] Menunggu reply ke media Lihat Sekali.' };
    }

    const wrapper =
      quoted.viewOnceMessageV2?.message ||
      quoted.viewOnceMessageV2Extension?.message ||
      quoted.viewOnceMessage?.message ||
      quoted;

    const type = Object.keys(wrapper || {}).find((k) =>
      ['imageMessage', 'videoMessage', 'audioMessage'].includes(k)
    );

    if (!type) {
      await sock.sendMessage(from, { text: "Pesan yang di-reply bukan media 'Lihat sekali'." }, { quoted: msg });
      return { text: '[bot] Bukan media Lihat Sekali.' };
    }

    try {
      const fakeMsg = { key: msg.message.extendedTextMessage.contextInfo, message: wrapper };
      const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});

      if (type === 'imageMessage') {
        await sock.sendMessage(from, { image: buffer, caption: wrapper.imageMessage.caption || '' });
      } else if (type === 'videoMessage') {
        await sock.sendMessage(from, { video: buffer, caption: wrapper.videoMessage.caption || '' });
      } else {
        await sock.sendMessage(from, { audio: buffer, mimetype: 'audio/mp4' });
      }

      print.success(`Berhasil membuka media 'Lihat sekali' untuk ${from}`);
      return { text: '[bot] Media Lihat Sekali dibuka ulang.' };
    } catch (err) {
      print.error('Gagal membuka media rvo: ' + err.message);
      await sock.sendMessage(from, { text: 'Gagal membuka media, medianya mungkin sudah kedaluwarsa.' }, { quoted: msg });
      return { text: '[bot] Gagal membuka media.' };
    }
  },
};
