 "use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import HeroImage from "@/public/images/purple-aesthetic-3840x2160-17734.jpg";

export default function App() {
  // Refs to DOM elements
  const fileRef = useRef(null);
  const timeCvRef = useRef(null);
  const freqCvRef = useRef(null);

  // Audio / recording refs
  const audioCtxRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const currentSourceRef = useRef(null);

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [decodedBuffer, setDecodedBuffer] = useState(null);
  const [origSamples, setOrigSamples] = useState(null);
  const [origSR, setOrigSR] = useState(44100);
  const [currentSamples, setCurrentSamples] = useState(null);
  const [currentSR, setCurrentSR] = useState(44100);
  const [detecting, setDetecting] = useState(false);
  const [detectJson, setDetectJson] = useState(null);
  const [aliasActive, setAliasActive] = useState(false);

  /* ---------- Helpers ---------- */
  function encodeWAV(samples, sampleRate) {
    const numSamples = samples.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const write = (o, s) => {
      for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
    };

    write(0, "RIFF");
    view.setUint32(4, 36 + numSamples * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, numSamples * 2, true);
    let off = 44;
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  function applyAliasing(data, originalRate, targetRate) {
    if (!data) return data;
    if (targetRate >= originalRate) return data;
    const ratio = originalRate / targetRate;
    const nOut = Math.max(1, Math.floor(data.length / ratio));
    const out = new Float32Array(nOut);
    for (let i = 0; i < nOut; i++) {
      out[i] = data[Math.min(data.length - 1, Math.floor(i * ratio))];
    }
    return out;
  }

  /* ---------- Visuals (draw functions ported) ---------- */
  function clearCanvas(cv) {
    const g = cv.getContext("2d");
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#0a0f1f";
    g.fillRect(0, 0, cv.width, cv.height);
  }

  function drawTime(cv, samples) {
    if (!cv || !samples) return;
    clearCanvas(cv);
    const g = cv.getContext("2d");
    const W = cv.width,
      H = cv.height;

    g.strokeStyle = "#1a1a1a";
    g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (H / 4) * i;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }

    g.strokeStyle = "#22d3ee";
    g.lineWidth = 2;
    g.beginPath();
    const step = Math.max(1, Math.floor(samples.length / W));
    const amp = H / 2;
    for (let x = 0, i = 0; x < W && i < samples.length; x++, i += step) {
      const y = amp + (samples[i] || 0) * amp * 0.8;
      if (x === 0) g.moveTo(0, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  function drawFreq(cv, data, sr) {
    if (!cv || !data) return;
    clearCanvas(cv);
    const g = cv.getContext("2d");
    const W = cv.width,
      H = cv.height;

    let N = Math.min(2048, data.length);
    N = Math.max(256, 1 << Math.floor(Math.log2(N)));

    const mags = new Float32Array(N / 2);
    for (let k = 0; k < N / 2; k++) {
      let re = 0,
        im = 0;
      for (let n = 0; n < N; n++) {
        const s = data[n] || 0;
        const ang = (2 * Math.PI * k * n) / N;
        re += s * Math.cos(ang);
        im -= s * Math.sin(ang);
      }
      mags[k] = Math.sqrt(re * re + im * im) / N;
    }

    const bars = Math.floor(mags.length / 4);
    const barW = W / bars;
    const maxMag = Math.max(1e-9, ...mags);

    const grad = g.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0, "#22d3ee");
    grad.addColorStop(0.5, "#10b981");
    grad.addColorStop(1, "#ffff00");
    g.fillStyle = grad;

    for (let i = 0; i < bars; i++) {
      const h = Math.min(H, (mags[i] / maxMag) * H);
      const x = i * barW;
      g.fillRect(x, H - h, barW - 1, h);
    }

    g.fillStyle = "#94a3b8";
    g.font = "12px system-ui, Arial";
    const nyq = Math.floor(sr / 2);
    g.fillText("0 Hz", 6, H - 6);
    g.fillText(`${Math.floor(nyq / 2)} Hz`, W / 2 - 24, H - 6);
    g.fillText(`${nyq} Hz`, W - 70, H - 6);
  }

  function refreshVisuals(samples = currentSamples, sr = currentSR) {
    if (!samples) return;
    const tcv = timeCvRef.current;
    const fcv = freqCvRef.current;
    if (!tcv || !fcv) return;
    const ratio = window.devicePixelRatio || 1;
    tcv.width = Math.floor(tcv.clientWidth * ratio);
    tcv.height = Math.floor(200 * ratio);
    fcv.width = Math.floor(fcv.clientWidth * ratio);
    fcv.height = Math.floor(300 * ratio);
    drawTime(tcv, samples);
    drawFreq(fcv, samples, sr);
  }

  async function ensureCtx() {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }

  async function decodeArrayBuffer(buf) {
    await ensureCtx();
    return new Promise((resolve, reject) => {
      audioCtxRef.current.decodeAudioData(buf.slice(0), resolve, reject);
    });
  }

  async function handleDecoded(decoded) {
    setDecodedBuffer(decoded);
    const sr = decoded.sampleRate || 44100;
    setOrigSR(sr);
    const ch0 = decoded.getChannelData(0);

    let peak = 1e-12;
    for (let i = 0; i < ch0.length; i++) peak = Math.max(peak, Math.abs(ch0[i]));
    const scale = peak > 0 ? 0.9 / peak : 1.0;
    const samples = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) samples[i] = ch0[i] * scale;

    setOrigSamples(samples);
    setCurrentSamples(samples);
    setCurrentSR(sr);
    setAliasActive(false);
    setDetectJson(null);

    setTimeout(() => refreshVisuals(samples, sr), 80);
  }

  async function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    try {
      const decoded = await decodeArrayBuffer(buf);
      await handleDecoded(decoded);
    } catch (err) {
      alert("Failed to decode audio: " + (err.message || err));
    }
  }

  async function onRecordClick() {
    try {
      await ensureCtx();
      if (!isRecording) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        const mr = new MediaRecorder(stream);
        mediaRecorderRef.current = mr;
        mr.ondataavailable = (ev) => chunks.push(ev.data);
        mr.onstop = async () => {
          try {
            const blob = new Blob(chunks, { type: "audio/webm" });
            const buf = await blob.arrayBuffer();
            const decoded = await decodeArrayBuffer(buf);
            await handleDecoded(decoded);
          } finally {
            stream.getTracks().forEach((t) => t.stop());
          }
        };
        mr.start();
        setIsRecording(true);
      } else {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
      }
    } catch (err) {
      alert("Microphone access error: " + (err.message || err));
    }
  }

  function onFsChange(e) {
    if (!origSamples) return;
    const target = parseInt(e.target.value, 10);
    if (target < origSR) {
      const aliased = applyAliasing(origSamples, origSR, target);
      setCurrentSamples(aliased);
      setCurrentSR(target);
      setAliasActive(true);
      setTimeout(() => refreshVisuals(aliased, target), 30);
    } else {
      setCurrentSamples(origSamples);
      setCurrentSR(origSR);
      setAliasActive(false);
      setTimeout(() => refreshVisuals(origSamples, origSR), 30);
    }
  }

  async function onPlayClick() {
    if (!decodedBuffer || !currentSamples) return;
    await ensureCtx();
    if (isPlaying) {
      try {
        currentSourceRef.current?.stop();
      } catch {}
      setIsPlaying(false);
      return;
    }
    const ctx = audioCtxRef.current;
    const buf = ctx.createBuffer(1, currentSamples.length, currentSR);
    buf.copyToChannel(currentSamples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => setIsPlaying(false);
    src.start();
    currentSourceRef.current = src;
    setIsPlaying(true);
  }

  async function detectBackend(float32, sr) {
    const blob = encodeWAV(float32, sr);
    const fd = new FormData();
    fd.append("file", blob, "clip.wav");
    const res = await fetch("http://127.0.0.1:8000/api/detect", { method: "POST", body: fd });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function detectSimulated(float32) {
    const N = float32.length;
    const abs = new Float32Array(N);
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const v = Math.abs(float32[i]);
      abs[i] = v;
      sum += v;
    }
    const avg = sum / N;
    const lo = 100,
      hi = 1000;
    let hf = 0;
    const win = hi - lo;
    for (let i = lo; i < hi && i < N; i++) hf += abs[i];
    hf /= Math.max(1, win);
    let confidence = Math.min(0.95, Math.max(0.05, (hf / Math.max(1e-9, avg)) * 0.7 + Math.random() * 0.3));
    const isDrone = confidence > 0.5;
    return { label: isDrone ? "drone" : "not_drone", probability: confidence };
  }

  async function onDetectClick() {
    if (!origSamples) return;
    setDetecting(true);
    setDetectJson(null);
    try {
      let js;
      try {
        js = await detectBackend(origSamples, origSR);
      } catch {
        const sim = await detectSimulated(origSamples);
        js = { label: sim.label, probability: sim.probability };
      }
      setDetectJson(js);
    } catch (err) {
      setDetectJson({ label: "error", probability: 0, message: (err.message || err) });
    } finally {
      setDetecting(false);
    }
  }

  useEffect(() => {
    refreshVisuals();
  }, [currentSamples, currentSR]);

  useEffect(() => {
    const onResize = () => refreshVisuals();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ---------- Render (keeps original HTML structure + CSS) ---------- */
  return (
    <div>
      <style>{`
        :root{
          --bg1:#0b1220; --bg2:#0e1a38; --card:#0f1a2c; --border:#1f2937;
          --text:#f1f5f9; --muted:#cbd5e1; --accent:#22d3ee; --green:#10b981; --red:#ef4444;
          --cyan:#06b6d4; --blue:#3b82f6; --purple:#a855f7; --pink:#ec4899; --emerald:#10b981;
        }
        html,body,#root{height:100%}
        body{
          margin:0; color:var(--text); font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;
          background: radial-gradient(1000px 600px at 10% 0%, #0a1125 0%, #0a1020 40%, #070b16 100%),
                      linear-gradient(135deg, #0d1b2a 0%, #0a1120 40%, #0a0f1f 100%);
        }
        .container{max-width:1100px;margin:0 auto;padding:24px}
        .center{text-align:center}
        .headline{font-size:42px;font-weight:800;
          background: linear-gradient(90deg, #22d3ee, #60a5fa); -webkit-background-clip:text; background-clip:text; color:transparent;}
        .sub{color:#a3b2c8;margin-top:6px}
        .grid{display:grid;gap:14px}
        @media(min-width:900px){ .grid-3{grid-template-columns:repeat(3,1fr)} }

        .card{background:var(--card); border:1px solid var(--border); border-radius:16px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,.25)}
        .btn{
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          padding:14px 16px; border-radius:12px; font-weight:700; color:#06181a; cursor:pointer; border:none;
          transition:transform .08s ease, filter .15s ease; user-select:none;
        }
        .btn:hover{filter:saturate(1.2)} .btn:active{transform:translateY(1px)}
        .btn-cyan{background:linear-gradient(90deg,#22d3ee,#3b82f6)}
        .btn-purple{background:linear-gradient(90deg,#a855f7,#ec4899)}
        .btn-green{background:linear-gradient(90deg,#10b981,#059669)}
        .btn-red{background:#ef4444;color:#fff}
        .btn[disabled]{opacity:.55; cursor:not-allowed}

        .panel{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
        .badge{display:inline-block;padding:6px 10px;border-radius:10px;background:#0e1729;color:#a7f3d0;border:1px solid #243047}
        .range{width:100%} .hint{color:#99a8be;font-size:13px}
        .row{display:grid;grid-template-columns:1fr;gap:12px}
        .kicker{display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:8px;color:#a5b4fc}
        .icon{width:20px;height:20px;display:inline-block}
        canvas{width:100%;height:220px;background:#0a0f1f;border-radius:12px;border:1px solid var(--border)}
        .footer{opacity:.75;font-size:12px;text-align:center;margin:12px 0}
        .result-ok{background:#10b98122;border:2px solid #10b981;border-radius:12px;padding:14px}
        .result-bad{background:#ef444422;border:2px solid #ef4444;border-radius:12px;padding:14px}
      `}</style>

      <div className="container">
        <div className="center" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
            <span className="icon" aria-hidden="true">📡</span>
            <div className="headline">Drone Audio Detection</div>
          </div>
          <div className="sub">AI-Powered Acoustic Analysis • Local-first UI</div>
        </div>

        <div className="card">
          <div className="grid grid-3">
            <button id="btnRecord" className={`btn ${isRecording ? "btn-red" : "btn-cyan"}`} onClick={onRecordClick}>
              <span>🎙️</span><span id="recLabel">{isRecording ? "Stop Recording" : "Record Audio"}</span>
            </button>

            <label className="btn btn-purple" style={{ cursor: "pointer", position: "relative", overflow: "hidden" }}>
              <span>📤</span> Upload Audio
              <input ref={fileRef} id="file" type="file" accept="audio/*" style={{ display: "none" }} onChange={onFileChange} />
            </label>

            <button id="btnDetect" className="btn btn-green" onClick={onDetectClick} disabled={!origSamples}>
              <span>✨</span><span id="detectText">{detecting ? "Analyzing..." : "Detect Drone"}</span>
            </button>
          </div>
          <div id="detectResult" style={{ marginTop: 14, display: detectJson ? "" : "none" }}>
            {detectJson && (
              <div className={detectJson.label === "drone" ? "result-bad" : "result-ok"}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                      {detectJson.label === "drone" ? "⚠️ Drone Detected" : "✅ No Drone Detected"}
                    </div>
                    <div>Confidence: <b>{((Number(detectJson.probability) || 0) * 100).toFixed(2)}%</b></div>
                    {detectJson.message && <div style={{ marginTop: 6, color: "#f8d7da" }}>{detectJson.message}</div>}
                  </div>
                  <div style={{ fontSize: 44 }}>{detectJson.label === "drone" ? "🚁" : "🔇"}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card" id="aliasCard" style={{ display: origSamples ? "" : "none", marginTop: 14 }}>
          <div className="kicker"><span>🌊</span><span>Aliasing Control</span></div>
          <label className="hint">
            Sampling Frequency: <b id="fsLabel">{currentSR}</b> Hz
            <span id="aliasNote" style={{ display: aliasActive ? "" : "none" }} className="badge" aria-live="polite">Aliasing Active</span>
          </label>
          <input id="fs" className="range" type="range" min="4000" max="48000" step="1000" value={currentSR} onChange={onFsChange} />
          <div className="hint" style={{ marginTop: 6 }}>Lower rates create aliasing. Frequencies above Nyquist (Fs/2) fold back into the spectrum.</div>
        </div>

        <div id="vizWrap" style={{ display: origSamples ? "" : "none", marginTop: 14 }}>
          <div className="card">
            <div className="kicker"><span>⏱️</span><span>Signal in Time Domain</span></div>
            <canvas id="timeCanvas" ref={timeCvRef} width="960" height="220" />
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="kicker"><span>📈</span><span>Frequency Spectrum</span></div>
            <canvas id="freqCanvas" ref={freqCvRef} width="960" height="300" />
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="kicker"><span>▶️</span><span>Audio Playback</span></div>
            <button id="btnPlay" className="btn btn-cyan" onClick={onPlayClick}><span id="playIcon">{isPlaying ? "⏹️" : "▶️"}</span><span id="playLabel">{isPlaying ? "Stop" : "Play Audio"}</span></button>
            <div className="hint" style={{ marginTop: 8 }}>
              Playback uses the current sampling rate (<b id="playFs">{currentSR}</b> Hz)
              <span id="playAliasHint" style={{ display: aliasActive ? "" : "none" }}> with aliasing applied</span>.
            </div>
          </div>
        </div>

        <div className="footer">🎵 Web Audio API • 🤖 Backend detection if available, else simulated • 📊 Real-time visuals</div>
      </div>
    </div>
  );
}
