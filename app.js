const $ = (selector) => document.querySelector(selector);
const startButton = $('#startButton');
const stopButton = $('#stopButton');
const state = $('#state');
const message = $('#message');
const transcript = $('#transcript');
const modelStatus = $('#modelStatus');
const engineStatus = $('#engineStatus');
const ENGINE_URL = 'http://127.0.0.1:8765';
let displayStream, micStream, audioContext, captureNode, silentGain, timerId, startedAt;
let systemAnalyser, micAnalyser, meterFrame;
let engineBusy = false, engineReady = false;

function setState(label, type = 'idle') { state.textContent = label; state.className = `state ${type}`; }
function showMessage(text = '') { message.textContent = text; }
function formatDuration(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function appendText(text) { if (!text?.trim()) return; transcript.textContent += `${transcript.textContent ? '\n' : ''}${text.trim()}`; transcript.scrollTop = transcript.scrollHeight; }

async function checkEngine() {
  try {
    const response = await fetch(`${ENGINE_URL}/health`, { cache: 'no-store' });
    const info = await response.json();
    engineReady = response.ok && info.ready;
    engineStatus.textContent = engineReady ? `로컬 엔진 연결됨 · ${info.model}` : '로컬 엔진이 준비되지 않았습니다.';
    return engineReady;
  } catch {
    engineReady = false;
    engineStatus.textContent = '로컬 엔진이 실행되지 않았습니다. 아래에서 내려받아 설치한 뒤 실행해 주세요.';
    return false;
  }
}

async function start() {
  if (!await checkEngine()) { showMessage('먼저 SignalScript Engine을 설치하고 실행해 주세요. 음성은 이 PC의 엔진으로만 전달됩니다.'); return; }
  try {
    showMessage('공유 창에서 전체 화면을 선택하고 “시스템 오디오 공유”를 켜주세요.');
    displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { suppressLocalAudioPlayback: false }, systemAudio: 'include' });
    if (!displayStream.getAudioTracks().length) throw new Error('시스템 오디오가 연결되지 않았습니다. “시스템 오디오 공유”를 켠 뒤 다시 시작해 주세요.');
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    audioContext = new AudioContext();
    const systemSource = audioContext.createMediaStreamSource(displayStream);
    const micSource = audioContext.createMediaStreamSource(micStream);
    systemAnalyser = audioContext.createAnalyser(); micAnalyser = audioContext.createAnalyser();
    systemAnalyser.fftSize = micAnalyser.fftSize = 256;
    systemSource.connect(systemAnalyser); micSource.connect(micAnalyser);
    await startPcmCapture(systemSource, micSource);
    displayStream.getVideoTracks()[0].addEventListener('ended', stop);
    startButton.disabled = true; stopButton.disabled = false; setState('전사 중', 'active'); showMessage('');
    modelStatus.textContent = '로컬 엔진이 최신 음성을 전사합니다.';
    startedAt = Date.now(); timerId = setInterval(() => { $('#timer').textContent = formatDuration(Math.floor((Date.now() - startedAt) / 1000)); }, 1000);
    drawMeters();
  } catch (error) { showMessage(error.message || '오디오 연결에 실패했습니다. 권한과 공유 옵션을 확인해 주세요.'); stop(); }
}

async function startPcmCapture(systemSource, micSource) {
  await audioContext.audioWorklet.addModule('./pcm-worklet.js');
  captureNode = new AudioWorkletNode(audioContext, 'pcm-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
  silentGain = audioContext.createGain(); silentGain.gain.value = 0;
  systemSource.connect(captureNode); micSource.connect(captureNode);
  captureNode.connect(silentGain); silentGain.connect(audioContext.destination);
  captureNode.port.onmessage = ({ data }) => {
    if (data.type === 'pcm') transcribe(new Float32Array(data.audio));
    if (data.type === 'quiet') modelStatus.textContent = '말소리를 기다리고 있습니다. 입력 레벨을 확인해 주세요.';
  };
}

async function transcribe(samples) {
  if (engineBusy) return;
  engineBusy = true; modelStatus.textContent = '방금 들린 음성을 로컬 엔진에서 전사하고 있습니다…';
  try {
    const language = $('#language').value === 'auto' ? 'auto' : 'ko';
    const response = await fetch(`${ENGINE_URL}/transcribe?language=${language}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: samples.buffer });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '로컬 엔진 전사에 실패했습니다.');
    appendText(data.text); modelStatus.textContent = '로컬 엔진이 전사 중입니다.';
  } catch (error) { showMessage(error.message); modelStatus.textContent = '로컬 엔진 연결 오류'; }
  finally { engineBusy = false; }
}

function drawMeters() {
  if (!audioContext) return;
  for (const [analyser, element] of [[systemAnalyser, $('#systemMeter')], [micAnalyser, $('#micMeter')]]) {
    const data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteTimeDomainData(data);
    const rms = Math.sqrt(data.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / data.length);
    element.style.width = `${Math.min(100, Math.max(1, rms * 420))}%`;
  }
  meterFrame = requestAnimationFrame(drawMeters);
}

function stop() {
  captureNode?.disconnect(); silentGain?.disconnect();
  displayStream?.getTracks().forEach((track) => track.stop()); micStream?.getTracks().forEach((track) => track.stop()); audioContext?.close();
  clearInterval(timerId); cancelAnimationFrame(meterFrame); $('#systemMeter').style.width = $('#micMeter').style.width = '0';
  displayStream = micStream = audioContext = captureNode = silentGain = systemAnalyser = micAnalyser = null;
  engineBusy = false; startButton.disabled = false; stopButton.disabled = true; setState('준비됨'); modelStatus.textContent = '로컬 엔진 연결을 확인한 뒤 시작합니다.';
}

startButton.addEventListener('click', start); stopButton.addEventListener('click', stop); checkEngine();
$('#clearButton').addEventListener('click', () => { transcript.textContent = ''; });
$('#copyButton').addEventListener('click', async () => { try { await navigator.clipboard.writeText(transcript.textContent); showMessage('전사 내용을 클립보드에 복사했습니다.'); } catch { showMessage('복사 권한이 필요합니다.'); } });
$('#downloadButton').addEventListener('click', () => { const file = new Blob([transcript.textContent], { type: 'text/plain;charset=utf-8' }); const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: `전사-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.txt` }); link.click(); URL.revokeObjectURL(link.href); });
