class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunks = [];
    this.length = 0;
    this.chunkSize = sampleRate * 5;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input?.length || !input[0]?.length) return true;

    const frames = input[0].length;
    const mixed = new Float32Array(frames);
    for (let channel = 0; channel < input.length; channel += 1) {
      const samples = input[channel];
      for (let index = 0; index < frames; index += 1) mixed[index] += samples[index] / input.length;
    }
    this.chunks.push(mixed);
    this.length += mixed.length;

    while (this.length >= this.chunkSize) {
      const joined = new Float32Array(this.length);
      let offset = 0;
      for (const chunk of this.chunks) { joined.set(chunk, offset); offset += chunk.length; }
      const segment = joined.slice(0, this.chunkSize);
      this.chunks = joined.length > this.chunkSize ? [joined.slice(this.chunkSize)] : [];
      this.length -= this.chunkSize;
      this.port.postMessage({ type: 'pcm', audio: segment.buffer }, [segment.buffer]);
    }
    return true;
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor);
