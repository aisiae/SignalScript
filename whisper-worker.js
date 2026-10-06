import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.0';

env.allowLocalModels = false;
let transcriber;
let transcriberPromise;
let selectedLanguage = 'korean';

async function getTranscriber() {
  if (transcriber) return transcriber;
  if (!transcriberPromise) {
    self.postMessage({ type: 'status', loading: true, text: 'Whisper 모델을 처음 준비하고 있습니다. 잠시만 기다려 주세요.' });
    const options = {
      dtype: 'q8',
      device: self.navigator?.gpu ? 'webgpu' : 'wasm',
      progress_callback: (progress) => {
        if (progress.status === 'progress') self.postMessage({ type: 'status', loading: true, text: `모델 준비 중… ${Math.round(progress.progress || 0)}%` });
      },
    };
    transcriberPromise = pipeline('automatic-speech-recognition', 'onnx-community/whisper-small', options)
      .catch(async () => pipeline('automatic-speech-recognition', 'onnx-community/whisper-small', { ...options, device: 'wasm' }));
  }
  transcriber = await transcriberPromise;
  return transcriber;
}

let queue = Promise.resolve();

self.onmessage = ({ data }) => {
  if (data.type === 'configure') { selectedLanguage = data.language; return; }
  if (data.type === 'warmup') {
    getTranscriber()
      .then(() => self.postMessage({ type: 'ready', text: '로컬 AI가 준비되었습니다. 최신 음성을 전사합니다.' }))
      .catch((error) => self.postMessage({ type: 'error', message: `모델을 준비하지 못했습니다: ${error.message}` }));
    return;
  }
  if (data.type !== 'transcribe') return;
  queue = queue.then(() => transcribe(data.audio)).catch((error) => {
    self.postMessage({ type: 'error', message: `전사에 실패했습니다: ${error.message}` });
  });
};

async function transcribe(audioBuffer) {
  try {
    const asr = await getTranscriber();
    const audio = new Float32Array(audioBuffer);
    const options = { task: 'transcribe', return_timestamps: false, chunk_length_s: 30, stride_length_s: 1 };
    if (selectedLanguage !== 'auto') options.language = selectedLanguage;
    const output = await asr(audio, options);
    self.postMessage({ type: 'result', text: output.text?.trim() || '' });
  } catch (error) { throw error; }
}
