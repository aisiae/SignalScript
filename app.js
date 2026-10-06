const $ = (selector) => document.querySelector(selector);
const startButton = $('#startButton');
const stopButton = $('#stopButton');
const state = $('#state');
const message = $('#message');
const transcript = $('#transcript');
const modelStatus = $('#modelStatus');
let displayStream, micStream, audioContext, captureNode, silentGain, worker, timerId, startedAt;
let systemAnalyser, micAnalyser;
let meterFrame;
let modelReady = false, workerBusy = false;

function setState(label, type = 'idle') { state.textContent = label; state.className = `state ${type}`; }
function showMessage(text = '') { message.textContent = text; }
function formatDuration(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function appendText(text) { if (!text?.trim()) return; transcript.textContent += `${transcript.textContent ? '\n' : ''}${text.trim()}`; transcript.scrollTop = transcript.scrollHeight; }

async function start() {
  try {
    showMessage('공유 창에서 전체 화면을 선택하고 “시스템 오디오 공유”를 켜주세요.');
    displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { suppressLocalAudioPlayback: false }, systemAudio: 'include' });
    if (!displayStream.getAudioTracks().length) throw new Error('시스템 오디오가 연결되지 않았습니다. 다시 시작해 “시스템 오디오 공유”를 켜주세요.');
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });

    audioContext = new AudioContext();
    const systemSource = audioContext.createMediaStreamSource(displayStream);
    const micSource = audioContext.createMediaStreamSource(micStream);
    systemAnalyser = audioContext.createAnalyser(); micAnalyser = audioContext.createAnalyser();
    systemAnalyser.fftSize = micAnalyser.fftSize = 256;
    systemSource.connect(systemAnalyser);
    micSource.connect(micAnalyser);
    createWorker($('#language').value);
    await startPcmCapture(systemSource, micSource);
    displayStream.getVideoTracks()[0].addEventListener('ended', stop);
    startButton.disabled = true; stopButton.disabled = false; setState('모델 준비 중', 'loading'); showMessage('모델이 준비되면 그 시점부터 최신 음성을 전사합니다.');
    startedAt = Date.now(); timerId = setInterval(() => { $('#timer').textContent = formatDuration(Math.floor((Date.now() - startedAt) / 1000)); }, 1000);
    drawMeters();
  } catch (error) { showMessage(error.message || '오디오 연결에 실패했습니다. 권한과 공유 옵션을 확인해 주세요.'); stop(); }
}

function createWorker(language) {
  worker = new Worker('./whisper-worker.js', { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'status') { modelStatus.textContent = data.text; if (data.loading) setState('모델 준비 중', 'loading'); }
    if (data.type === 'ready') { modelReady = true; modelStatus.textContent = data.text; setState('전사 중', 'active'); showMessage(''); }
    if (data.type === 'result') { workerBusy = false; appendText(data.text); modelStatus.textContent = '로컬 AI가 전사 중입니다.'; setState('전사 중', 'active'); }
    if (data.type === 'error') { workerBusy = false; showMessage(data.message); modelStatus.textContent = '전사 엔진 오류'; }
  };
  worker.postMessage({ type: 'configure', language });
  worker.postMessage({ type: 'warmup' });
}

async function startPcmCapture(systemSource, micSource) {
  // AudioWorklet은 메인 UI와 분리된 오디오 스레드에서 신호를 안정적으로 수집합니다.
  await audioContext.audioWorklet.addModule('./pcm-worklet.js');
  captureNode = new AudioWorkletNode(audioContext, 'pcm-capture', {
    numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit',
  });
  silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  systemSource.connect(captureNode);
  micSource.connect(captureNode);
  captureNode.connect(silentGain);
  silentGain.connect(audioContext.destination);
  captureNode.port.onmessage = ({ data }) => {
    if (data.type === 'pcm') collectPcm(new Float32Array(data.audio));
    if (data.type === 'quiet') {
      modelStatus.textContent = '말소리를 기다리고 있습니다. 입력 레벨이 너무 작으면 마이크·시스템 볼륨을 올려 주세요.';
    }
  };
}

function collectPcm(samples) {
  // 모델 준비 전 또는 이전 전사 중의 오래된 구간은 건너뛰어 지연이 누적되지 않게 합니다.
  if (!modelReady || workerBusy) return;
  const audio = downsampleTo16k(samples, audioContext.sampleRate);
  workerBusy = true;
  modelStatus.textContent = '방금 들린 음성을 전사하고 있습니다…';
  worker.postMessage({ type: 'transcribe', audio: audio.buffer }, [audio.buffer]);
}

function downsampleTo16k(input, sourceRate) {
  if (sourceRate === 16000) return input.slice();
  const ratio = sourceRate / 16000;
  const output = new Float32Array(Math.round(input.length / ratio));
  for (let index = 0; index < output.length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(input.length, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let sample = start; sample < end; sample += 1) sum += input[sample];
    output[index] = sum / Math.max(1, end - start);
  }
  return output;
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
  displayStream?.getTracks().forEach((track) => track.stop()); micStream?.getTracks().forEach((track) => track.stop()); audioContext?.close(); worker?.terminate();
  clearInterval(timerId); $('#systemMeter').style.width = $('#micMeter').style.width = '0';
  cancelAnimationFrame(meterFrame);
  displayStream = micStream = audioContext = captureNode = silentGain = worker = systemAnalyser = micAnalyser = null;
  modelReady = false; workerBusy = false;
  startButton.disabled = false; stopButton.disabled = true; setState('준비됨'); modelStatus.textContent = '시작하면 로컬 AI 모델을 준비합니다.';
}

startButton.addEventListener('click', start); stopButton.addEventListener('click', stop);
$('#clearButton').addEventListener('click', () => { transcript.textContent = ''; });
$('#copyButton').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(transcript.textContent); showMessage('전사 내용을 클립보드에 복사했습니다.'); }
  catch { showMessage('복사 권한이 필요합니다. 전사문을 선택해 직접 복사해 주세요.'); }
});
$('#downloadButton').addEventListener('click', () => { const file = new Blob([transcript.textContent], { type: 'text/plain;charset=utf-8' }); const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: `전사-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.txt` }); link.click(); URL.revokeObjectURL(link.href); });
