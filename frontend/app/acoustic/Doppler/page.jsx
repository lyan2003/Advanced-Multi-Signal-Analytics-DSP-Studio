"use client";
import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import HeroImage from "@/public/images/purple-aesthetic-3840x2160-17734.jpg";
import { useRouter } from "next/navigation";

const SOUND_SPEED = 343;

export default function AcousticAnalyzer() {
  const router = useRouter();
  // =================== Doppler States ===================
  const [v, setV] = useState(20);
  const [f0, setF0] = useState(440);
  const [distance, setDistance] = useState(5);
  const [playing, setPlaying] = useState(false);
  const [dopplerWaveform, setDopplerWaveform] = useState(new Float32Array(0));

  const [tempV, setTempV] = useState(v);
  const [tempF0, setTempF0] = useState(f0);
  const [tempDistance, setTempDistance] = useState(distance);

  const [activeTab, setActiveTab] = useState("doppler");

  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const gainRef = useRef(null);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);

  // =================== Doppler Functions ===================
  function startSim() {
  if (playing) return;
  setV(tempV);
  setF0(tempF0);
  setDistance(tempDistance);

  const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
  audioCtxRef.current = ctx;

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";

  const gain = ctx.createGain();
  gain.gain.value = 0.15;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyserRef.current = analyser;

  osc.connect(gain);
  gain.connect(analyser);
  analyser.connect(ctx.destination);

  osc.start();
  oscRef.current = osc;
  gainRef.current = gain;
  setPlaying(true);

  setTimeout(() => {
    function draw() {
      if (!analyserRef.current || !oscRef.current) return;
      const data = new Float32Array(analyserRef.current.fftSize);
      analyserRef.current.getFloatTimeDomainData(data);
      setDopplerWaveform(Float32Array.from(data));
      requestAnimationFrame(draw);
    }
    draw();
  }, 100);
}

  function stopSim() {
    if (oscRef.current) {
      oscRef.current.stop();
      oscRef.current.disconnect();
      gainRef.current.disconnect();
      setPlaying(false);
    }
  }

  useEffect(() => {
    if (oscRef.current && playing) {
      const t0 = 0;
      const x = v * (0 - t0);
      const r = Math.sqrt(x * x + distance * distance);
      const v_r = (x * v) / Math.max(1e-6, r);
      const f_obs = f0 * (SOUND_SPEED / (SOUND_SPEED - v_r));
      oscRef.current.frequency.setValueAtTime(f_obs, audioCtxRef.current.currentTime);
    }
  }, [v, f0, distance, playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!dopplerWaveform || dopplerWaveform.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = "#A78BFA";
    const step = dopplerWaveform.length / canvas.width;
    for (let i = 0; i < canvas.width; i++) {
      const val = dopplerWaveform[Math.floor(i * step)] || 0;
      const y = (1 - (val + 1) / 2) * canvas.height;
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [dopplerWaveform]);


   const handleSave = async () => {
  if (!audioCtxRef.current || !gainRef.current) {
    alert("Start the simulation first!");
    return;
  }

  try {
    const ctx = audioCtxRef.current;
    const dest = ctx.createMediaStreamDestination();
    gainRef.current.connect(dest);

    // Recorder setup
    const mediaRecorder = new MediaRecorder(dest.stream);
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doppler_${f0}Hz_${v}ms.wav`;
      a.click();
      URL.revokeObjectURL(url);
    };

    // Record for 3 seconds (you can change duration)
    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 3000);
    alert("Recording started for 3 seconds...");
  } catch (e) {
    console.error("Saving error:", e);
    alert("Error saving generated sound!");
  }
};


  // =================== Uploaded Audio States ===================
  const [uploadedWaveform, setUploadedWaveform] = useState(new Float32Array(0));
  const [results, setResults] = useState({ fEst: 0, vEst: 0 });
  const uploadedBufferRef = useRef(null);
  const uploadedSourceRef = useRef(null);
  const uploadedAnalyserRef = useRef(null);
  const uploadedCanvasRef = useRef(null);

  const [aliasedF, setAliasedF] = useState(f0);
  const [aliasedWaveform, setAliasedWaveform] = useState(new Float32Array(0));
  const aliasedSourceRef = useRef(null);
  const aliasedAnalyserRef = useRef(null);
  const [aliasedReady, setAliasedReady] = useState(false);

  // =================== STOP Functions ===================
  function stopUploadedAudio() {
  if (uploadedSourceRef.current) {
    uploadedSourceRef.current.stop();
    uploadedSourceRef.current.disconnect();
    uploadedSourceRef.current = null;
  }
  if (uploadedAnalyserRef.current) {
    uploadedAnalyserRef.current.disconnect();
    uploadedAnalyserRef.current = null;
  }
}

function stopAliasedAudio() {
  if (aliasedSourceRef.current) {
    aliasedSourceRef.current.stop();
    aliasedSourceRef.current.disconnect();
    aliasedSourceRef.current = null;
  }
  if (aliasedAnalyserRef.current) {
    aliasedAnalyserRef.current.disconnect();
    aliasedAnalyserRef.current = null;
  }
}

  function stopAllAudio() {
    stopUploadedAudio();
    stopAliasedAudio();
  }

  // =================== Doppler Frequency Update ===================
  useEffect(() => {
    if (oscRef.current && playing) {
      const f_obs = f0 * (SOUND_SPEED / (SOUND_SPEED - v));
      oscRef.current.frequency.setValueAtTime(f_obs, audioCtxRef.current.currentTime);
      const vEst = SOUND_SPEED * (f_obs / f0 - 1) / (f_obs / f0 + 1);
      setResults({ fEst: Math.round(f_obs), vEst: Math.abs(vEst) });
    }
  }, [v, f0, distance, playing]);

  // =================== Draw Doppler waveform ===================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!dopplerWaveform || dopplerWaveform.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = "#A78BFA";
    const step = dopplerWaveform.length / canvas.width;
    for (let i = 0; i < canvas.width; i++) {
      const val = dopplerWaveform[Math.floor(i * step)] || 0;
      const y = (1 - (val + 1) / 2) * canvas.height;
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [dopplerWaveform]);

  // =================== Uploaded Audio Functions ===================
  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    stopAllAudio();

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = audioCtxRef.current || new AudioContext();
    audioCtxRef.current = ctx;

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    uploadedBufferRef.current = audioBuffer;

    const channelData = audioBuffer.getChannelData(0);
    setUploadedWaveform(Float32Array.from(channelData.slice(0, Math.min(channelData.length, 4096))));

    setAliasedF(f0);
    setAliasedWaveform(new Float32Array(0));
    setAliasedReady(false);

    const slice = channelData.slice(0, 2048);
    const lag = autocorr(slice, audioBuffer.sampleRate);
    const fEst = lag > 0 ? audioBuffer.sampleRate / lag : 0;
    const vEst = fEst > 0 ? SOUND_SPEED * (fEst / 440 - 1) / (fEst / 440 + 1) : 0;
    setResults({ fEst: Math.round(fEst), vEst: Math.abs(vEst) });
  }

  function autocorr(buf, sampleRate) {
    const n = buf.length;
    let bestLag = 0;
    let bestVal = -Infinity;
    for (let lag = 20; lag < Math.min(600, n); lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) sum += buf[i] * buf[i + lag];
      if (sum > bestVal) {
        bestVal = sum;
        bestLag = lag;
      }
    }
    return bestLag;
  }

  function playUploadedAudio() {
    if (!uploadedBufferRef.current) return;
    stopAllAudio();

    const ctx = audioCtxRef.current;
    const src = ctx.createBufferSource();
    src.buffer = uploadedBufferRef.current;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    uploadedAnalyserRef.current = analyser;

    src.connect(analyser);
    analyser.connect(ctx.destination);
    src.start(0);
    uploadedSourceRef.current = src;

    setAliasedReady(false);

    const channelData = uploadedBufferRef.current.getChannelData(0).slice(0, 2048);
    setUploadedWaveform(Float32Array.from(channelData));

    function tick() {
      if (!uploadedAnalyserRef.current) return;
      const data = new Float32Array(uploadedAnalyserRef.current.fftSize);
      uploadedAnalyserRef.current.getFloatTimeDomainData(data);
      setUploadedWaveform(Float32Array.from(data));
      requestAnimationFrame(tick);
    }
    tick();

    src.onended = () => { uploadedSourceRef.current = null; };
  }

  function playAliasedAudio() {
    if (!uploadedBufferRef.current) return;
    stopAllAudio();

    const originalBuffer = uploadedBufferRef.current;
    const channelData = originalBuffer.getChannelData(0);

    const playbackRate = aliasedF / f0;

    const ctx = audioCtxRef.current;
    const buffer = ctx.createBuffer(1, channelData.length, originalBuffer.sampleRate);
    buffer.copyToChannel(channelData, 0, 0);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    aliasedAnalyserRef.current = analyser;

    src.connect(analyser);
    analyser.connect(ctx.destination);
    src.start(0);
    aliasedSourceRef.current = src;

    setAliasedReady(true);

    const fEst = f0 * playbackRate;
    const vEst = SOUND_SPEED * (fEst / f0 - 1) / (fEst / f0 + 1);
    setResults({ fEst: Math.round(fEst), vEst: Math.abs(vEst) });

    function tick() {
      if (!aliasedAnalyserRef.current) return;
      const data = new Float32Array(aliasedAnalyserRef.current.fftSize);
      aliasedAnalyserRef.current.getFloatTimeDomainData(data);
      setAliasedWaveform(Float32Array.from(data));
      requestAnimationFrame(tick);
    }
    tick();

    src.onended = () => { aliasedSourceRef.current = null; };
  }

  function handleAliasedSliderChange(e) {
    const newF = Number(e.target.value);
    setAliasedF(newF);
  }

  useEffect(() => {
    const canvas = uploadedCanvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dataToDraw = aliasedReady ? aliasedWaveform : uploadedWaveform;
    if (!dataToDraw || dataToDraw.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = "#22D3EE";
    const step = dataToDraw.length / canvas.width;
    for (let i = 0; i < canvas.width; i++) {
      const val = dataToDraw[Math.floor(i * step)] || 0;
      const y = (1 - (val + 1) / 2) * canvas.height;
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [uploadedWaveform, aliasedWaveform, aliasedReady]);

  // =================== Render ===================
  return (
    <div
  className="relative p-6 text-gray-100 min-h-screen space-y-10"
>
  {/* 🌌 Background Image */}
  <Image
    src={HeroImage}
    alt="Background"
    fill
    priority
    className="object-cover object-center brightness-[0.35] -z-10"
  />

  <div className="flex justify-between items-center mb-6 max-w-5xl mx-auto relative z-10">
    <h1 className="text-4xl font-extrabold">
      {activeTab === "doppler" ? "Vehicle Doppler Analyzer" : "Drone Acoustic Analyzer"}
    </h1>
    <div className="flex gap-4">
      <button
        onClick={() => setActiveTab("doppler")}
        className={`px-12 py-2 rounded-xl text-2xl font-semibold ${
          activeTab === "doppler" ? "bg-indigo-600" : "bg-gray-700"
        }`}
      >
        Doppler
      </button>
      <button
        onClick={() => router.push("/acoustic/Drone")}
        className="px-12 py-2 rounded-xl text-2xl font-semibold bg-gray-700 hover:bg-yellow-400 hover:text-black transition"
      >
        Drone
      </button>
    </div>
  </div>



      {/* Doppler Tab */}
      {activeTab === "doppler" && (
        <div className="space-y-8 max-w-5xl mx-auto">
          <div className="bg-gray-800 p-8 rounded-3xl shadow-lg space-y-6">
            <h2 className="text-2xl font-semibold text-indigo-200">Live Doppler Simulation</h2>
            <label className="flex items-center justify-between">
              <span>Velocity v (m/s)</span>
              <input type="range" min="1" max="50" value={tempV} onChange={(e) => setTempV(Number(e.target.value))} className="w-48" />
              <span className="w-16 text-right">{tempV} m/s</span>
            </label>
            <label className="flex items-center justify-between">
              <span>Horn freq f (Hz)</span>
              <input type="range" min="100" max="2000" value={tempF0} onChange={(e) => setTempF0(Number(e.target.value))} className="w-48" />
              <span className="w-16 text-right">{tempF0} Hz</span>
            </label>
            <label className="flex items-center justify-between">
              <span>Closest approach (m)</span>
              <input type="range" min="1" max="50" value={tempDistance} onChange={(e) => setTempDistance(Number(e.target.value))} className="w-48" />
              <span className="w-16 text-right">{tempDistance} m</span>
            </label>
            <div className="flex gap-4 mt-4">
              <button onClick={startSim} disabled={playing} className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all">Start</button>
              <button onClick={stopSim} disabled={!playing} className="px-4 py-2 rounded bg-gradient-to-r from-violet-400 to-indigo-400 text-white font-semibold shadow-md hover:from-indigo-300 hover:to-violet-300 hover:shadow-lg hover:scale-105 transition-all">Stop</button>
              <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all">💾 Save</button>
            </div>
            <canvas ref={canvasRef} className="w-full h-60 bg-gray-900 rounded mt-4 border border-white" />
          </div>

          {/* Uploaded Audio */}
          <div className="bg-gray-800 p-8 rounded-3xl shadow-lg space-y-6">
            <h2 className="text-2xl font-semibold text-indigo-200">Uploaded Audio Analysis</h2>
                        <input type="file" accept="audio/*" onChange={handleFile} className="w-full text-gray-200" />

            <div className="flex gap-4 mt-4">
              <button onClick={playUploadedAudio} className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all">Play Original</button>
              <button onClick={stopUploadedAudio} className="px-4 py-2 rounded bg-gradient-to-r from-violet-400 to-indigo-400 text-white font-semibold shadow-md hover:from-indigo-300 hover:to-violet-300 hover:shadow-lg hover:scale-105 transition-all">Stop</button>
            </div>

            <div className="mt-6">
              <label className="flex items-center justify-between">
                <span>Aliased Frequency (Hz)</span>
                <input
                  type="range"
                  min="50"
                  max="2000"
                  value={aliasedF}
                  onChange={handleAliasedSliderChange}
                  className="w-48"
                />
                <span className="w-16 text-right">{aliasedF} Hz</span>
              </label>
              <div className="flex gap-4 mt-4">
                <button onClick={playAliasedAudio} className="px-5 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold shadow-md hover:from-cyan-400 hover:to-violet-400 hover:shadow-lg hover:scale-105 transition-all">Play Aliased</button>
                <button onClick={stopAliasedAudio} className="px-4 py-2 rounded bg-gradient-to-r from-violet-400 to-indigo-400 text-white font-semibold shadow-md hover:from-indigo-300 hover:to-violet-300 hover:shadow-lg hover:scale-105 transition-all">Stop</button>
              </div>
            </div>

            <div className="mt-6">
              <canvas ref={uploadedCanvasRef} className="w-full h-60 bg-gray-900 rounded border border-white" />
            </div>

            <div className="mt-4 text-indigo-200">
              <p>Estimated Frequency: {results.fEst} Hz</p>
              <p>Estimated Velocity: {results.vEst.toFixed(2)} m/s</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
