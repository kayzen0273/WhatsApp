/**
 * lib/print.js
 * Semua output terminal lewat sini, biar konsisten & rapi.
 */
const chalk = require('chalk');

const WIDTH = 56;
const line = (ch = '─') => ch.repeat(WIDTH);

function timestamp() {
  return new Date().toLocaleTimeString('id-ID', { hour12: false });
}

function box(title, rows = []) {
  const top = chalk.gray('┌' + line() + '┐');
  const bottom = chalk.gray('└' + line() + '┘');
  const head = chalk.gray('│ ') + chalk.bold.whiteBright(title.padEnd(WIDTH - 2)) + chalk.gray(' │');
  const sep = chalk.gray('├' + line() + '┤');
  const body = rows.map((r) => {
    const plain = r.replace(/\x1b\[[0-9;]*m/g, '');
    const pad = Math.max(0, WIDTH - 2 - plain.length);
    return chalk.gray('│ ') + r + ' '.repeat(pad) + chalk.gray(' │');
  });
  console.log([top, head, sep, ...body, bottom].join('\n'));
}

function banner(port) {
  console.log(
    chalk.yellowBright(`
  ██████╗  █████╗ ████████╗███████╗██╗    ██╗ █████╗ ██╗   ██╗
 ██╔════╝ ██╔══██╗╚══██╔══╝██╔════╝██║    ██║██╔══██╗╚██╗ ██╔╝
 ██║  ███╗███████║   ██║   █████╗  ██║ █╗ ██║███████║ ╚████╔╝
 ██║   ██║██╔══██║   ██║   ██╔══╝  ██║███╗██║██╔══██║  ╚██╔╝
 ╚██████╔╝██║  ██║   ██║   ███████╗╚███╔███╔╝██║  ██║   ██║
  ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝
`)
  );
  box('Gateway — Dasbor WhatsApp', [
    chalk.gray('URL     ') + chalk.white(`http://localhost:${port}`),
    chalk.gray('Mode    ') + chalk.white('QR / Pairing Code (8 digit)'),
    chalk.gray('Status  ') + chalk.yellow('menunggu koneksi...'),
  ]);
  console.log();
}

function info(msg) {
  console.log(chalk.gray(`[${timestamp()}]`), chalk.cyan('ℹ INFO '), msg);
}
function success(msg) {
  console.log(chalk.gray(`[${timestamp()}]`), chalk.green('✔ OK   '), msg);
}
function warn(msg) {
  console.log(chalk.gray(`[${timestamp()}]`), chalk.yellow('⚠ WARN '), msg);
}
function error(msg) {
  console.log(chalk.gray(`[${timestamp()}]`), chalk.red('✖ ERROR'), msg);
}
function command(from, cmd) {
  console.log(
    chalk.gray(`[${timestamp()}]`),
    chalk.magenta('➜ CMD  '),
    chalk.white(from),
    chalk.gray('menjalankan'),
    chalk.bold.yellowBright(cmd)
  );
}
function pairingCode(code) {
  box('Kode Pairing WhatsApp', ['', chalk.bold.yellowBright('   ' + code), '', chalk.gray('Perangkat Tertaut → Tautkan dengan nomor telepon')]);
}
function connected(number) {
  box('Terhubung', [chalk.green('Nomor  ') + chalk.white(number), chalk.green('Status ') + chalk.white('aktif sebagai bot')]);
}

module.exports = { banner, info, success, warn, error, command, pairingCode, connected, box };
