const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const root = __dirname;
const bin = path.join(root, 'bin');
const serverExe = path.join(bin, 'whisper-server.exe');
const model = path.join(root, 'models', 'ggml-base.bin');
const inferenceUrl = 'http://127.0.0.1:8178/inference';
const chunks = path.join(os.tmpdir(), 'signalscript-engine');
fs.mkdirSync(chunks, { recursive: true });

let engineState = 'starting';
let engineError = '';
let whisperServer;
let busy = false;

function allowedOrigin(origin = '') {
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) || /^https?:\/\/localhost(?::\d+)?$/i.test(origin);
}
function cors(request, response) {
  const origin = request.headers.origin || '';
  if (allowedOrigin(origin)) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin'); response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); response.setHeader('Access-Control-Allow-Private-Network', 'true');
}
function json(response, status, payload) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(payload)); }
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function startWhisperServer() {
  if (!fs.existsSync(serverExe)) throw new Error('whisper-server.exe is missing. Run Install-Engine.cmd again.');
  if (!fs.existsSync(model)) throw new Error('The Korean Whisper Base model is missing. Run Install-Engine.cmd again.');
  const threads = String(Math.max(2, Math.min(4, os.cpus().length - 1)));
  whisperServer = spawn(serverExe, ['-m', path.relative(root, model), '--host', '127.0.0.1', '--port', '8178', '-t', threads, '-sns', '-mc', '0', '-nth', '0.65'], { windowsHide: true, cwd: root });
  whisperServer.stderr.on('data', (data) => process.stderr.write(data));
  whisperServer.on('error', (error) => { engineState = 'error'; engineError = error.message; });
  whisperServer.on('exit', (code) => { if (engineState !== 'stopping') { engineState = 'error'; engineError = `Whisper server exited (${code}).`; } });
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try { if ((await fetch('http://127.0.0.1:8178/')).ok) { engineState = 'ready'; return; } } catch {}
    await wait(1000);
  }
  throw new Error('The Whisper server did not become ready in time.');
}

function writeWav(samples) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[index])) * 32767), index * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  const wav = path.join(chunks, `${randomUUID()}.wav`); fs.writeFileSync(wav, Buffer.concat([header, pcm])); return wav;
}

async function transcribe(buffer, language) {
  const wav = writeWav(new Float32Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.length / 4)));
  try {
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(wav)], { type: 'audio/wav' }), 'audio.wav');
    form.append('response_format', 'json'); form.append('temperature', '0.0'); form.append('no_speech_thold', '0.65');
    if (language !== 'auto') form.append('language', language);
    const response = await fetch(inferenceUrl, { method: 'POST', body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Whisper inference failed.');
    return result.text?.trim() || '';
  } finally { try { fs.unlinkSync(wav); } catch {} }
}

http.createServer(async (request, response) => {
  cors(request, response);
  if (request.method === 'OPTIONS') { response.writeHead(204); return response.end(); }
  if (!allowedOrigin(request.headers.origin || '')) return json(response, 403, { error: 'This website is not allowed.' });
  if (request.method === 'GET' && request.url === '/health') return json(response, engineState === 'ready' ? 200 : 503, { ready: engineState === 'ready', state: engineState, model: 'Whisper Base · persistent local engine', error: engineError });
  if (request.method !== 'POST' || !request.url.startsWith('/transcribe')) return json(response, 404, { error: 'Not found.' });
  if (engineState !== 'ready') return json(response, 503, { error: 'The local model is still loading.' });
  if (busy) return json(response, 429, { error: 'The previous audio is still being processed.' });
  busy = true; const buffers = [];
  request.on('data', (chunk) => buffers.push(chunk));
  request.on('end', async () => {
    try { const language = new URL(request.url, 'http://localhost').searchParams.get('language') || 'ko'; json(response, 200, { text: await transcribe(Buffer.concat(buffers), language) }); }
    catch (error) { json(response, 500, { error: error.message }); }
    finally { busy = false; }
  });
}).listen(8765, '127.0.0.1', () => console.log('SignalScript Engine is starting on 127.0.0.1:8765'));

startWhisperServer().then(() => console.log('SignalScript Engine is ready.')).catch((error) => { engineState = 'error'; engineError = error.message; console.error(error.message); });
process.on('SIGINT', () => { engineState = 'stopping'; whisperServer?.kill(); process.exit(0); });
