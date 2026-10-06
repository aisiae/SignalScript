import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.0';

env.allowLocalModels = false;
let transcriber;
let selectedLanguage = 'korean';

async function getTranscriber() {
  if (transcriber) return transcriber;
  self.postMessage({ type: 'status', loading: true, text: 'Whisper 모델을 처음 준비하고 있습니다. 잠시만 기다려 주세요.' });
  transcriber = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-small', {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (progress) => {
      if (progress.status === 'progress') self.postMessage({ type: 'status', loading: true, text: `모델 준비 중… ${Math.round(progress.progress || 0)}%` });
    },
  });
  return transcriber;
}

async function decodeAudio(buffer) {
  const context = new OfflineAudioContext(1, 1, 16000);
  const decoded = await context.decodeAudioData(buffer);
  const targetLength = Math.ceil(decoded.duration * 16000);
  const resampler = new OfflineAudioContext(1, targetLength, 16000);
  const source = resampler.createBufferSource(); source.buffer = decoded; source.connect(resampler.destination); source.start();
  return (await resampler.startRendering()).getChannelData(0);
}

self.onmessage = async ({ data }) => {
  if (data.type === 'configure') { selectedLanguage = data.language; return; }
  if (data.type !== 'transcribe') return;
  try {
    const [asr, audio] = await Promise.all([getTranscriber(), decodeAudio(data.audio)]);
    const options = { task: 'transcribe', return_timestamps: false, chunk_length_s: 30, stride_length_s: 1 };
    if (selectedLanguage !== 'auto') options.language = selectedLanguage;
    const output = await asr(audio, options);
    self.postMessage({ type: 'result', text: output.text });
  } catch (error) { self.postMessage({ type: 'error', message: `전사에 실패했습니다: ${error.message}` }); }
};
