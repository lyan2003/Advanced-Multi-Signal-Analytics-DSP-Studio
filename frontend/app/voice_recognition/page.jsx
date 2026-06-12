"use client";
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import HeroImage from "@/public/images/workflow-02.png";

export default function SpeechAliasingDemo() {
  const [fileName, setFileName] = useState("No file selected");
  const [origBuffer, setOrigBuffer] = useState(null);
  const [audioCtx, setAudioCtx] = useState(null);
  const [fs_khz, setFsKHz] = useState(44);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const fileRef = useRef(null);
  const srcNodeRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const aliasedCanvasRef = useRef(null);
  const spectrumCanvasRef = useRef(null); //  Spectrum Canvas

  useEffect(() => {
    setAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
    return () => {
      try {
        audioCtx?.close();
      } catch (e) {}
    };
  }, []);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("audio")) {
      setError("❌ Please upload an audio file (.wav, .mp3, etc.)");
      return;
    }
    setError("");
    setFileName(f.name);
    const arrayBuffer = await f.arrayBuffer();
    const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    setOrigBuffer(decoded);
  };

  const stopAll = () => {
    try {
      if (srcNodeRef.current) {
        srcNodeRef.current.stop();
        srcNodeRef.current.disconnect();
        srcNodeRef.current = null;
      }
    } catch (e) {}
    setPlaying(false);
  };

  const handleVoiceRecognition = async () => {
  if (!origBuffer) {
    alert("Please upload an audio file first!");
    return;
  }

  const wavBlob = audioBufferToWavBlobFast(origBuffer);
  const formData = new FormData();
  formData.append("file", wavBlob, "voice.wav");

  try {
    const res = await fetch("http://127.0.0.1:8000/api/voice/predict", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Prediction failed");

    const data = await res.json();
    setPrediction(data);
    setShowResult(true);
  } catch (e) {
    console.error(e);
    alert("Error connecting to backend");
  }
};
function makeAliasedBuffer(buffer, targetSR_khz) {
  const targetSR = Math.round(targetSR_khz * 1000);
  const srcSR = buffer.sampleRate;
  const ratio = targetSR / srcSR;
  const downLen = Math.max(1, Math.floor(buffer.length * ratio));
  const ch = buffer.numberOfChannels;  // Get number of channels (e.g., 1 for mono, 2 for stereo)
  const down = []; // Array to hold downsampled data for each channel
  // --- Step 1: Downsample ---
  for (let c = 0; c < ch; c++) {
    const src = buffer.getChannelData(c); // Get the original audio data for this channel
    const d = new Float32Array(downLen); // Create a new Float32Array to store the downsampled signal

    for (let i = 0; i < downLen; i++) {  // Fill the new array by picking samples based on the target rate

      const srcIdx = Math.round(i * srcSR / targetSR); // Compute which index in the original signal corresponds to this downsampled position
      d[i] = src[Math.min(src.length - 1, srcIdx)]; // Copy that sample (clamping the index to stay inside the source array)
    }
    // Store this channel's downsampled data
    down.push(d);
  }

  // --- Step 2: Upsample back to original length ---
  const outLen = buffer.length;
  // Create arrays for each channel to store upsampled data
  const channelsOut = Array.from({ length: ch }, () => new Float32Array(outLen));
  for (let c = 0; c < ch; c++) {
    const d = down[c]; // downsampled data for this channel

    for (let n = 0; n < outLen; n++) {
      // Compute the corresponding index in the downsampled array
      const idx = Math.round(n * (downLen / outLen));

      // Copy that value into the upsampled output array
      channelsOut[c][n] = d[Math.min(downLen - 1, idx)];
    }
  }

  // --- Step 3: Create a new AudioBuffer to hold the aliased sound ---
  // Use existing AudioContext or create a new one
  const newBuf = (audioCtx || new (window.AudioContext || window.webkitAudioContext)())
    .createBuffer(ch, outLen, buffer.sampleRate);

  // Copy processed data back into the new AudioBuffer
  for (let c = 0; c < ch; c++) newBuf.copyToChannel(channelsOut[c], c, 0);

  // Return the new aliased AudioBuffer
  return newBuf;
}


  function visualizeAudio(buffer, canvas, ctx, color = "rgb(173, 216, 230)") {
    if (!canvas || !buffer) return;

    const analyser = ctx.createAnalyser();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    analyser.fftSize = 2048;

    const dataArray = new Uint8Array(analyser.fftSize);
    const freqArray = new Uint8Array(analyser.frequencyBinCount);
    const canvasCtx = canvas.getContext("2d");
    const spectrumCanvas = spectrumCanvasRef.current;
    const spectrumCtx = spectrumCanvas?.getContext("2d");
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    function draw() {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      analyser.getByteFrequencyData(freqArray);

      // 🎶 Draw waveform
      canvasCtx.fillStyle = "rgba(0, 0, 0, 0.25)";
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = color;
      canvasCtx.beginPath();

      const sliceWidth = WIDTH / dataArray.length;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * HEIGHT) / 2;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += sliceWidth;
      }
      canvasCtx.lineTo(WIDTH, HEIGHT / 2);
      canvasCtx.stroke();

      // 🎛️ Draw spectrum (bars)
      if (spectrumCtx) {
        spectrumCtx.fillStyle = "rgba(0, 0, 0, 0.3)";
        spectrumCtx.fillRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
        const barWidth = (spectrumCanvas.width / freqArray.length) * 2.5;
        let x = 0;
        for (let i = 0; i < freqArray.length; i++) {
          const barHeight = freqArray[i] / 2;
          const hue = 250 - (i / freqArray.length) * 200;
          spectrumCtx.fillStyle = `hsl(${hue}, 100%, 60%)`;
          spectrumCtx.fillRect(x, spectrumCanvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }
    }

    draw();
    source.start();
    srcNodeRef.current = source;
    setPlaying(true);
    source.onended = () => setPlaying(false);
  }

  const playBuffer = (buffer, isAliased = false) => {
    stopAll();
    const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const canvas = isAliased ? aliasedCanvasRef.current : originalCanvasRef.current;
    const color = isAliased ? "rgb(255, 105, 180)" : "rgb(173, 216, 230)";
    visualizeAudio(buffer, canvas, ctx, color);
  };

  const handlePlayOriginal = () => {
    if (!origBuffer) return setError("Upload an audio file first.");
    playBuffer(origBuffer, false);
  };

  const handlePlayAliased = async () => {
    if (!origBuffer) return setError("Upload an audio file first.");
    setProcessing(true);
    try {
      const buf = makeAliasedBuffer(origBuffer, fs_khz);
      playBuffer(buf, true);
    } catch (e) {
      setError("Processing error: " + String(e));
    } finally {
      setProcessing(false);
    }
  };

  const handleAntiAlias = async () => {
  if (!origBuffer) {
    alert("Please upload an audio file first!");
    return;
  }

  try {
    setProcessing(true);

    const aliasedBuf = makeAliasedBuffer(origBuffer, fs_khz);
    const wavBlob = audioBufferToWavBlobFast(aliasedBuf);
    const formData = new FormData();
    formData.append("file", wavBlob, "voice.wav");

    const res = await fetch("http://127.0.0.1:8000/api/audio/antialias", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Anti-aliasing failed");

    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));

    playBuffer(decoded, false);

  } catch (e) {
    console.error("Anti-aliasing error:", e);
    alert("Error applying anti-aliasing filter!");
  } finally {
    setProcessing(false);
  }
};

  const handleSave = async () => {
    if (!origBuffer) {
      alert("Please upload an audio file first!");
      return;
    }

    try {
      const aliasedBuf = makeAliasedBuffer(origBuffer, fs_khz);
      const wavBlob = audioBufferToWavBlobFast(aliasedBuf);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aliased_${fs_khz}kHz.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Saving error:", e);
      alert("Error saving audio file!");
    }
  };

  function audioBufferToWavBlobFast(buffer) {
    const numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArr = new ArrayBuffer(length),
      view = new DataView(bufferArr),
      channels = [],
      sampleRate = buffer.sampleRate;
    let offset = 0;
    writeUTFBytes(view, offset, "RIFF"); offset += 4;
    view.setUint32(offset, 36 + buffer.length * numOfChan * 2, true); offset += 4;
    writeUTFBytes(view, offset, "WAVE"); offset += 4;
    writeUTFBytes(view, offset, "fmt "); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * 2 * numOfChan, true); offset += 4;
    view.setUint16(offset, numOfChan * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeUTFBytes(view, offset, "data"); offset += 4;
    view.setUint32(offset, buffer.length * numOfChan * 2, true); offset += 4;
    for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
    let interleaved = new Float32Array(buffer.length * numOfChan);
    for (let i = 0; i < buffer.length; i++) for (let c = 0; c < numOfChan; c++) interleaved[i * numOfChan + c] = channels[c][i];
    let index = 44;
    for (let i = 0; i < interleaved.length; i++, index += 2) {
      const s = Math.max(-1, Math.min(1, interleaved[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([view], { type: "audio/wav" });
  }

  function writeUTFBytes(view, offset, string) {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  }

  const renderTicks = () => {
    const ticks = [];
    for (let v = 2; v <= 100; v += 10) ticks.push(v);
    return (
      <div className="w-full flex justify-between text-xs text-gray-400 mt-1 px-1">
        {ticks.map((t) => (
          <div key={t} className="text-center">{t}k</div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative min-h-screen flex flex-col text-gray-100">
      <Image src={HeroImage} alt="bg" fill priority className="object-cover object-center -z-10 brightness-[0.35]" />

      {/* Header */}
      <header className="bg-gray-900/70 backdrop-blur-lg border-b border-indigo-700 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-3xl font-bold text-indigo-300">Speech Sampling Demo</h1>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 rounded bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold hover:scale-105 transition-transform"
            >
              📂 Upload Audio
            </button>
            <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleFile} />
            <span className="text-sm text-gray-300">{fileName}</span>
          </div>

          <div className="text-sm text-gray-300">
            Sampling Rate: <span className="font-mono text-indigo-400">{fs_khz} kHz</span>
          </div>
        </div>
      </header>

      {showResult && (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
        <div className="bg-gray-900 border border-indigo-500 rounded-2xl shadow-2xl p-8 w-[350px] text-center">
          <h2 className="text-xl font-bold text-indigo-400 mb-3">🎧 Voice Recognition Result</h2>
          <p className="text-gray-200 text-lg">
            Gender: <span className="text-pink-400 font-semibold">{prediction?.label}</span>
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Confidence: {(prediction?.confidence * 100).toFixed(1)}%
          </p>
          <button
            onClick={() => setShowResult(false)}
            className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    )}

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-5xl bg-[#141414]/90 border border-indigo-500/30 rounded-2xl p-8 shadow-xl backdrop-blur-sm">
          <div className="mb-3 text-gray-200 font-medium">Adjust Sampling Frequency (kHz)</div>

          <input
            type="range"
            min={2}
            max={100}
            step={1}
            value={fs_khz}
            onChange={(e) => setFsKHz(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          {renderTicks()}

          <div className="mt-3 text-sm text-gray-300">
            Selected: <span className="font-mono">{fs_khz} kHz ({fs_khz * 1000} Hz)</span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={handlePlayOriginal} className="px-4 py-2 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-500">▶ Original</button>
            <button onClick={handlePlayAliased} className="px-4 py-2 rounded bg-gradient-to-r from-violet-400 to-indigo-400 text-white font-semibold shadow-md hover:from-indigo-300 hover:to-violet-300 hover:shadow-lg hover:scale-105 transition-all">⚡ Aliased</button>
            <button onClick={handleAntiAlias} className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all">🌀 Anti-Aliased</button>
            <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all">💾 Save</button>
            <button onClick={stopAll} className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-600">⏹ Stop</button>
            <button onClick={handleVoiceRecognition} className="px-5 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold shadow-md hover:from-cyan-400 hover:to-violet-400 hover:shadow-lg hover:scale-105 transition-all">🎙️ Voice Recognition</button>

          </div>

          <div className="mt-8 flex flex-col items-center gap-8">
            <div className="text-indigo-300 font-semibold mb-1">Original Signal</div>
            <canvas ref={originalCanvasRef} width={600} height={200} className="bg-black rounded-xl border border-indigo-700 shadow-md" />

            <div className="text-pink-400 font-semibold mt-6 mb-1">Aliased Signal</div>
            <canvas ref={aliasedCanvasRef} width={600} height={200} className="bg-black rounded-xl border border-pink-700 shadow-md" />

            {/* 🎛️ Spectrum Analyzer */}
            <div className="text-cyan-300 font-semibold mt-8 mb-2">Spectrum Analyzer</div>
            <canvas ref={spectrumCanvasRef} width={600} height={180} className="bg-black rounded-xl border border-cyan-700 shadow-md" />
          </div>
        </div>

        <div className="mt-6 max-w-5xl text-sm text-gray-400 text-center">
          This demo shows how reducing the sampling rate causes aliasing in speech signals.
          Try lowering the rate to hear distortion in higher-pitched voices (like female voices).
        </div>
      </main>
    </div>
  );
}
