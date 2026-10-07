const http = require('node:http');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

const scriptPath = path.join(__dirname, 'captions-reader.ps1');

let engineState = 'starting';
let engineError = '';
let captionFound = false;
let captionText = '';
let seq = 0;
let reader;

function allowedOrigin(origin = '') {
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) || /^https?:\/\/localhost(?::\d+)?$/i.test(origin);
}
function cors(request, response) {
  const origin = request.headers.origin || '';
  if (allowedOrigin(origin)) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin'); response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); response.setHeader('Access-Control-Allow-Private-Network', 'true');
}
function json(response, status, payload) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(payload)); }

function startReader() {
  reader = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { windowsHide: true });
  engineState = 'ready';
  readline.createInterface({ input: reader.stdout }).on('line', (line) => {
    try { const data = JSON.parse(line.replace(/^﻿/, '')); captionFound = data.found; captionText = data.text || ''; seq += 1; } catch {}
  });
  reader.stderr.on('data', (data) => process.stderr.write(data));
  reader.on('error', (error) => { engineState = 'error'; engineError = error.message; });
  reader.on('exit', (code) => { if (engineState !== 'stopping') { engineState = 'error'; engineError = `Live Captions reader exited (${code}).`; } });
}

http.createServer((request, response) => {
  cors(request, response);
  if (request.method === 'OPTIONS') { response.writeHead(204); return response.end(); }
  if (!allowedOrigin(request.headers.origin || '')) return json(response, 403, { error: 'This website is not allowed.' });
  if (request.method === 'GET' && request.url === '/health') return json(response, engineState === 'ready' ? 200 : 503, { ready: engineState === 'ready', state: engineState, model: 'Windows 라이브 캡션', captions: captionFound, error: engineError });
  if (request.method === 'GET' && request.url.startsWith('/captions')) return json(response, 200, { found: captionFound, text: captionText, seq });
  return json(response, 404, { error: 'Not found.' });
}).listen(8765, '127.0.0.1', () => console.log('SignalScript Engine is running on 127.0.0.1:8765'));

startReader();
process.on('SIGINT', () => { engineState = 'stopping'; reader?.kill(); process.exit(0); });
process.on('exit', () => reader?.kill());
