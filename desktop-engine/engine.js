const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');

const run = promisify(execFile);
const root = __dirname;
const cli = path.join(root, 'bin', 'whisper-cli.exe');
const model = path.join(root, 'models', 'ggml-small.bin');
const chunks = path.join(os.tmpdir(), 'signalscript-engine');
fs.mkdirSync(chunks, { recursive: true });

function allowedOrigin(origin = '') {
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) || /^https?:\/\/localhost(?::\d+)?$/i.test(origin);
}
function cors(request, response) {
  const origin = request.headers.origin || '';
  if (allowedOrigin(origin)) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(response, status, payload) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(payload)); }
function writeWav(samples) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) pcm.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767, i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  const base = path.join(chunks, randomUUID()); const wav = `${base}.wav`;
  fs.writeFileSync(wav, Buffer.concat([header, pcm])); return { base, wav };
}
async function transcribe(buffer, language) {
  if (!fs.existsSync(cli)) throw new Error('whisper-cli.exe를 찾지 못했습니다. Install-Engine.ps1을 다시 실행해 주세요.');
  if (!fs.existsSync(model)) throw new Error('한국어 Whisper 모델을 찾지 못했습니다. Install-Engine.ps1을 다시 실행해 주세요.');
  const { base, wav } = writeWav(new Float32Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.length / 4)));
  try {
    const args = ['-m', model, '-f', wav, '-nt', '-np', '-otxt', '-of', base];
    if (language !== 'auto') args.push('-l', language);
    await run(cli, args, { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
    const textPath = `${base}.txt`;
    return fs.existsSync(textPath) ? fs.readFileSync(textPath, 'utf8').trim() : '';
  } finally {
    for (const extension of ['.wav', '.txt']) { try { fs.unlinkSync(`${base}${extension}`); } catch {} }
  }
}

let busy = false;
http.createServer(async (request, response) => {
  cors(request, response);
  if (request.method === 'OPTIONS') { response.writeHead(204); return response.end(); }
  if (!allowedOrigin(request.headers.origin || '')) return json(response, 403, { error: '허용되지 않은 웹사이트입니다.' });
  if (request.method === 'GET' && request.url === '/health') return json(response, 200, { ready: fs.existsSync(cli) && fs.existsSync(model), model: 'Whisper Small · 로컬 엔진' });
  if (request.method !== 'POST' || !request.url.startsWith('/transcribe')) return json(response, 404, { error: '찾을 수 없는 요청입니다.' });
  if (busy) return json(response, 429, { error: '이전 음성을 처리하고 있습니다.' });
  busy = true;
  const buffers = [];
  request.on('data', (chunk) => buffers.push(chunk));
  request.on('end', async () => {
    try {
      const language = new URL(request.url, 'http://localhost').searchParams.get('language') || 'ko';
      const text = await transcribe(Buffer.concat(buffers), language);
      json(response, 200, { text });
    } catch (error) { json(response, 500, { error: error.message }); }
    finally { busy = false; }
  });
}).listen(8765, '127.0.0.1', () => console.log('SignalScript Engine is ready on 127.0.0.1:8765'));
