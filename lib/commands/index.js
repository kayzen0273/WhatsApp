/**
 * Registry command. Tambah command baru = tambah 1 file di folder ini,
 * lalu daftarkan di bawah. Setiap command wajib punya `prefix`,
 * `description`, dan fungsi async `run({ sock, from, msg, text, print })`.
 */
const ping = require('./ping');
const rvo = require('./rvo');
const html = require('./html');
const menu = require('./menu');

module.exports = {
  ping,  // .ping        -> cek bot masih hidup
  rvo,   // .rvo         -> buka ulang media "Lihat sekali"
  html,  // .html <kode> -> kirim kode HTML, dirender hidup di dashboard
  menu,  // .menu        -> daftar command
};
