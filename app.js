const $ = (selector) => document.querySelector(selector);
const startButton = $('#startButton');
const stopButton = $('#stopButton');
const state = $('#state');
const message = $('#message');
const transcript = $('#transcript');
const live = $('#live');
const modelStatus = $('#modelStatus');
const engineStatus = $('#engineStatus');
const installGuide = $('#installGuide');
const ENGINE_URL = 'http://127.0.0.1:8765';
let pollId, timerId, startedAt, lastCaption = '', polling = false;

function setState(label, type = 'idle') { state.textContent = label; state.className = `state ${type}`; }
function showMessage(text = '') { message.textContent = text; }
function formatDuration(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function normalize(text) { return text.replace(/\s+([.,?!])/g, '$1').replace(/\s+/g, ' ').trim(); }
function commonPrefix(a, b) { let index = 0; while (index < a.length && index < b.length && a[index] === b[index]) index += 1; return index; }
function appendText(text) {
  for (const sentence of normalize(text).split(/(?<=[.?!。])\s+/)) {
    if (!sentence) continue;
    transcript.textContent += `${transcript.textContent ? '\n' : ''}${sentence}`;
  }
  transcript.scrollTop = transcript.scrollHeight;
}
function fullText() { return [transcript.textContent, live.textContent].filter(Boolean).join('\n'); }

async function checkEngine() {
  try {
    const response = await fetch(`${ENGINE_URL}/health`, { cache: 'no-store' });
    const info = await response.json();
    const ready = response.ok && info.ready;
    engineStatus.textContent = ready ? `로컬 엔진 연결됨 · ${info.model}` : '로컬 엔진이 준비되지 않았습니다.';
    return ready;
  } catch {
    engineStatus.textContent = '로컬 엔진이 실행되지 않았습니다. 아래에서 내려받아 Start-Engine.cmd를 실행해 주세요.';
    return false;
  }
}

// 라이브 캡션 창은 최근 몇 문장만 유지하므로, 앞부분이 사라지거나 문장이 바뀔 때 확정된 글자를 전사문으로 옮깁니다.
function onCaption(raw) {
  const current = normalize(raw);
  if (current === lastCaption) return;
  if (lastCaption) {
    const sameSegment = commonPrefix(lastCaption, current) >= Math.min(10, Math.ceil(lastCaption.length / 2));
    if (!sameSegment) {
      let cut = lastCaption.length;
      for (let index = 1; index <= lastCaption.length - 8; index += 1) {
        if (current.startsWith(lastCaption.slice(index))) { cut = index; break; }
      }
      appendText(lastCaption.slice(0, cut));
    }
  }
  lastCaption = current;
  live.textContent = current.split(/(?<=[.?!。])\s+/).join('\n');
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    const data = await (await fetch(`${ENGINE_URL}/captions`, { cache: 'no-store' })).json();
    if (!data.found) { modelStatus.textContent = 'Windows 라이브 캡션 창을 찾는 중입니다. Win+Ctrl+L로 켜 주세요.'; return; }
    modelStatus.textContent = '라이브 캡션의 자막을 가져오는 중입니다.';
    onCaption(data.text);
  } catch { modelStatus.textContent = '로컬 엔진 연결 오류'; }
  finally { polling = false; }
}

async function start() {
  if (!await checkEngine()) { showMessage('먼저 SignalScript Engine을 실행해 주세요. (Start-Engine.cmd)'); return; }
  showMessage('');
  lastCaption = ''; live.textContent = '';
  startButton.disabled = true; stopButton.disabled = false; setState('전사 중', 'active');
  startedAt = Date.now(); timerId = setInterval(() => { $('#timer').textContent = formatDuration(Math.floor((Date.now() - startedAt) / 1000)); }, 1000);
  pollId = setInterval(poll, 300); poll();
}

function stop() {
  clearInterval(pollId); clearInterval(timerId);
  if (lastCaption) appendText(lastCaption);
  lastCaption = ''; live.textContent = '';
  startButton.disabled = false; stopButton.disabled = true; setState('준비됨'); modelStatus.textContent = '시작하면 라이브 캡션의 자막을 가져옵니다.';
}

startButton.addEventListener('click', start); stopButton.addEventListener('click', stop); checkEngine();
$('#installGuideButton').addEventListener('click', () => installGuide.showModal());
$('#closeInstallGuide').addEventListener('click', () => installGuide.close());
$('#clearButton').addEventListener('click', () => { transcript.textContent = ''; });
$('#copyButton').addEventListener('click', async () => { try { await navigator.clipboard.writeText(fullText()); showMessage('전사 내용을 클립보드에 복사했습니다.'); } catch { showMessage('복사 권한이 필요합니다.'); } });
$('#downloadButton').addEventListener('click', () => { const file = new Blob([fullText()], { type: 'text/plain;charset=utf-8' }); const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: `전사-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.txt` }); link.click(); URL.revokeObjectURL(link.href); });
