"use client";
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Papa from "papaparse";
import HeroImage from "@/public/images/home.jpg";

const EEG_LABELS = [
  "Fp1", "Fp2", "F3", "F4",
  "C3", "C4", "P3", "P4",
];

// ===== Mini Sweep Canvas ===== (unchanged)
function MiniSweep({ time, values, playing, speed, timeWindow, center, halfspan, color }) {
  const canvasRef = useRef(null);
  const traceRef = useRef(null);
  const st = useRef({ sweepX: 0, lastX: null, lastY: null, tCursor: 0, prev: performance.now() });

  const wrapDur = Math.max(1e-6, (time?.[time.length - 1] ?? 0) - (time?.[0] ?? 0));

  const interpAt = (ts) => {
    if (!time || time.length === 0) return 0;
    if (time.length === 1) return values?.[0] ?? 0;
    let lo = 0, hi = time.length - 1;
    if (ts <= time[0]) return values?.[0] ?? 0;
    if (ts >= time[hi]) return values?.[hi] ?? 0;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (time[mid] <= ts) lo = mid; else hi = mid;
    }
    const t0 = time[lo], t1 = time[hi];
    const y0 = values?.[lo] ?? 0, y1 = values?.[hi] ?? 0;
    const f = (ts - t0) / Math.max(1e-9, t1 - t0);
    return y0 + f * (y1 - y0);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpi = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const wCSS = canvas.clientWidth || 100;
    const hCSS = canvas.clientHeight || 100;

    if (canvas.width !== wCSS * dpi || canvas.height !== hCSS * dpi) {
      canvas.width = wCSS * dpi;
      canvas.height = hCSS * dpi;
      traceRef.current = null;
      st.current.sweepX = 0;
      st.current.lastX = null;
      st.current.lastY = null;
    }

    const ctx = canvas.getContext("2d");
    const w = wCSS, h = hCSS;
    const rx = 40, ry = 10, rw = w - 50, rh = h - 30;

    if (!traceRef.current) {
      const off = document.createElement("canvas");
      off.width = w * dpi; off.height = h * dpi;
      const octx = off.getContext("2d");
      octx.setTransform(dpi, 0, 0, dpi, 0, 0);
      traceRef.current = off;
    }

    const octx = traceRef.current.getContext("2d");
    const now = performance.now();
    const dtMs = now - st.current.prev; st.current.prev = now;

    if (playing) {
      const dtLogical = (timeWindow / 200.0) * speed * (dtMs / 16.6667);
      st.current.tCursor += dtLogical;
      let dx = Math.max(0.5, (dtLogical / timeWindow) * rw);
      let newX = st.current.sweepX + dx;
      let wrapped = false;
      if (newX >= rw) { newX -= rw; wrapped = true; }

      const clearW = Math.max(1, Math.ceil(dx));
      const x0 = Math.floor(newX);
      octx.clearRect(rx + x0, ry, Math.min(clearW, rw - x0), rh);
      const w2 = clearW - Math.min(clearW, rw - x0);
      if (w2 > 0) octx.clearRect(rx, ry, w2, rh);

      const ts = (time?.[0] ?? 0) + (st.current.tCursor % wrapDur);
      const val = interpAt(ts);
      const y = ry + (rh / 2) - ((val - center) / halfspan) * (rh / 2);
      octx.strokeStyle = color;
      octx.lineWidth = 1.5;
      octx.lineCap = "round";
      if (wrapped || st.current.lastX == null || st.current.lastY == null) {
        octx.beginPath(); octx.moveTo(rx + newX, y); octx.lineTo(rx + newX, y); octx.stroke();
      } else {
        octx.beginPath(); octx.moveTo(rx + st.current.lastX, st.current.lastY); octx.lineTo(rx + newX, y); octx.stroke();
      }
      st.current.lastX = newX; st.current.lastY = y; st.current.sweepX = newX;
    }

    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgb(110,110,110)";
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.drawImage(traceRef.current, 0, 0);
  };

  useEffect(() => {
    let raf = requestAnimationFrame(function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, timeWindow, center, halfspan, time, values]);

  return <canvas ref={canvasRef} className="w-full h-full rounded-md" />;
}

// ===== Polar Sweep ===== (unchanged)
function PolarSweep({ time, channels, selectedChannels, playing, speed }) {
  const canvasRef = useRef(null);
  const st = useRef({ tCursor: 0, prev: performance.now(), points: {} });

  const wrapDur = Math.max(1e-6, (time?.[time.length - 1] ?? 0) - (time?.[0] ?? 0));

  const interpAt = (ts, values) => {
    if (!time || time.length === 0) return 0;
    if (time.length === 1) return values?.[0] ?? 0;
    let lo = 0, hi = time.length - 1;
    if (ts <= time[0]) return values?.[0] ?? 0;
    if (ts >= time[hi]) return values?.[hi] ?? 0;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (time[mid] <= ts) lo = mid; else hi = mid;
    }
    const t0 = time[lo], t1 = time[hi];
    const y0 = values?.[lo] ?? 0, y1 = values?.[hi] ?? 0;
    const f = (ts - t0) / Math.max(1e-9, t1 - t0);
    return y0 + f * (y1 - y0);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpi = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const wCSS = canvas.clientWidth || 100;
    const hCSS = canvas.clientHeight || 100;

    if (canvas.width !== wCSS * dpi || canvas.height !== hCSS * dpi) {
      canvas.width = wCSS * dpi;
      canvas.height = hCSS * dpi;
      st.current.points = {};
      selectedChannels.forEach(i => st.current.points[i] = []);
      st.current.tCursor = 0;
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpi, 0, 0, dpi, 0, 0);

    const w = wCSS, h = hCSS;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) / 2 - 40;

    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(200,200,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("0°", cx + radius + 15, cy);
    ctx.fillText("180°", cx - radius - 15, cy);
    ctx.fillText("90°", cx, cy - radius - 15);
    ctx.fillText("270°", cx, cy + radius + 15);

    const now = performance.now();
    const dtMs = now - st.current.prev; st.current.prev = now;

    if (playing) {
      const dtLogical = speed * (dtMs / 16.6667);
      st.current.tCursor += dtLogical;
      const ts = (time?.[0] ?? 0) + (st.current.tCursor % wrapDur);

      selectedChannels.forEach((chIndex) => {
        const val = interpAt(ts, channels[chIndex]);
        const minV = Math.min(...channels[chIndex]);
        const maxV = Math.max(...channels[chIndex]);
        const angle = 2 * Math.PI * ((ts - time[0]) / wrapDur);
        const r = ((val - minV) / (maxV - minV)) * radius;
        const x = cx + r * Math.cos(angle - Math.PI / 2);
        const y = cy + r * Math.sin(angle - Math.PI / 2);
        if (!st.current.points[chIndex]) st.current.points[chIndex] = [];
        st.current.points[chIndex].push({ x, y });
      });
    }

    selectedChannels.forEach((chIndex) => {
      ctx.strokeStyle = `hsl(${(chIndex * 30) % 360}, 85%, 60%)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      st.current.points[chIndex]?.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  };

  useEffect(() => {
    let raf = requestAnimationFrame(function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, time, channels, selectedChannels]);

  return <canvas ref={canvasRef} className="w-full h-[400px] rounded-md" />;
}

// ===== Reoccurrence Graph ===== (unchanged)
function ReoccurrenceGraph({ time, channels, selectedChannels, timeWindow, colorMap }) {
  const canvasRef = useRef(null);
  const [pair, setPair] = useState({ chX: 0, chY: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedChannels.length < 2) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;

    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, w, h);

    const chX = channels[pair.chX];
    const chY = channels[pair.chY];
    if (!chX || !chY) return;

    const n = Math.min(chX.length, chY.length);
    ctx.fillStyle = colorMap;

    const minX = Math.min(...chX); const maxX = Math.max(...chX);
    const minY = Math.min(...chY); const maxY = Math.max(...chY);

    for (let i = 0; i < n; i++) {
      const x = ((chX[i] - minX) / (maxX - minX)) * w;
      const y = h - ((chY[i] - minY) / (maxY - minY)) * h;
      ctx.fillRect(x, y, 2, 2);
    }

    // Axes
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(40, h - 20);
    ctx.lineTo(w, h - 20);
    ctx.stroke();

  }, [channels, pair, selectedChannels, colorMap]);

  return (
    <div className="flex flex-col items-center gap-3 w-full h-full">
      <div className="flex gap-4 mb-2">
        <label className="text-white">
          X Channel:
          <select
            className="ml-2 text-black rounded px-2 py-1"
            value={pair.chX}
            onChange={(e) => setPair((prev) => ({ ...prev, chX: Number(e.target.value) }))}
          >
            {selectedChannels.map((i) => (
              <option key={i} value={i}>{EEG_LABELS[i] || `Lead ${i + 1}`}</option>
            ))}
          </select>
        </label>
        <label className="text-white">
          Y Channel:
          <select
            className="ml-2 text-black rounded px-2 py-1"
            value={pair.chY}
            onChange={(e) => setPair((prev) => ({ ...prev, chY: Number(e.target.value) }))}
          >
            {selectedChannels.map((i) => (
              <option key={i} value={i}>{EEG_LABELS[i] || `Lead ${i + 1}`}</option>
            ))}
          </select>
        </label>
        <label className="text-white">
          Colormap:
          <select
            className="ml-2 text-black rounded px-2 py-1"
            value={colorMap}
            onChange={(e) => e.target.value}
          >
            <option value="#00ffff">Cyan</option>
            <option value="#ff00ff">Magenta</option>
            <option value="#00ff00">Green</option>
            <option value="#ffaa00">Orange</option>
            <option value="#ff0000">Red</option>
          </select>
        </label>
      </div>

      <canvas ref={canvasRef} className="w-[600px] h-[400px] border border-indigo-600 rounded-lg shadow-lg" />
    </div>
  );
}

// ===== XOR Sweep ===== (unchanged)
function XORSweep({ time, channels, selectedChannels, timeWindow, playing, speed }) {
  const canvasRef = useRef(null);
  const st = useRef({ lastChunks: [], tCursor: 0, prev: performance.now(), points: {} });

  const wrapDur = Math.max(1e-6, (time?.[time.length - 1] ?? 0) - (time?.[0] ?? 0));

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpi = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const wCSS = canvas.clientWidth || 100;
    const hCSS = canvas.clientHeight || 100;

    if (canvas.width !== wCSS * dpi || canvas.height !== hCSS * dpi) {
      canvas.width = wCSS * dpi;
      canvas.height = hCSS * dpi;
      st.current.lastChunks = [];
      st.current.points = {};
      selectedChannels.forEach((i) => st.current.points[i] = []);
      st.current.tCursor = 0;
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpi, 0, 0, dpi, 0, 0);

    const w = wCSS, h = hCSS;
    const rx = 40, ry = 20, rw = w - 60, rh = h - 40;

    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, w, h);

    if (playing) {
      const now = performance.now();
      const dtMs = now - st.current.prev;
      st.current.prev = now;
      const dtLogical = speed * (dtMs / 16.6667);
      st.current.tCursor += dtLogical;

      const chunkStart = (time?.[0] ?? 0) + (st.current.tCursor % wrapDur);
      const chunkEnd = chunkStart + timeWindow;

      const chunk = selectedChannels.map((chIndex) => {
        return time.map((t, i) => {
          if (t >= chunkStart && t < chunkEnd) return channels[chIndex][i];
          return 0;
        });
      });

      if (st.current.lastChunks.length > 0) {
        chunk.forEach((chArr, chIdx) => {
          for (let i = 0; i < chArr.length; i++) {
            const prevVal = st.current.lastChunks[chIdx][i];
            if (Math.abs(chArr[i] - prevVal) < 1e-6) chArr[i] = 0; // متساوي تقريبًا → 0
          }
        });
      }

      st.current.lastChunks = chunk.map((chArr) => [...chArr]);

      selectedChannels.forEach((chIndex, idx) => {
        chunk[idx].forEach((val, i) => {
          const x = rx + ((time[i] - chunkStart) / timeWindow) * rw;
          const y = ry + rh / 2 - val * (rh / 2);
          st.current.points[chIndex].push({ x, y });
        });
      });
    }

    selectedChannels.forEach((chIndex, idx) => {
      ctx.strokeStyle = `hsl(${(chIndex * 30) % 360}, 85%, 60%)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      st.current.points[chIndex].forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });

    ctx.strokeStyle = "rgb(110,110,110)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
  };

  useEffect(() => {
    let raf = requestAnimationFrame(function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, time, channels, selectedChannels, timeWindow]);

  return <canvas ref={canvasRef} className="w-full h-[400px] rounded-md" />;
}

function PredictOverlay({ open, onClose, result }) {
  if (!open) return null;

  const labels = ["Normal", "Seizure", "Artifact"];
  const probs = result?.probs || [];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-indigo-600 rounded-2xl shadow-xl p-6 w-[400px] text-white text-center">
        <h2 className="text-2xl font-bold mb-4 text-indigo-400">🧠 EEG Prediction Result</h2>
        {result?.error ? (
          <p className="text-red-400">{result.error}</p>
        ) : (
          <ul className="text-left mx-auto w-fit">
            {labels.map((lbl, i) => (
              <li key={i} className="flex justify-between border-b border-gray-700 py-1">
                <span>{lbl}</span>
                <span className="font-semibold text-indigo-300">
                  {probs[i] !== undefined ? probs[i].toFixed(20) : "--"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={onClose}
          className="mt-6 bg-indigo-600 px-5 py-2 rounded-lg hover:bg-indigo-500 transition"
        >
          ✖ Close
        </button>
      </div>
    </div>
  );
}

// ===== Main Page =====
export default function EEGPage() {
  const [predOpen, setPredOpen] = useState(false);
  const [predResult, setPredResult] = useState(null);

  // files
  const [rawCsvFile, setRawCsvFile] = useState(null);
  const [edfFile, setEdfFile] = useState(null);

  // UI / playback
  const [category, setCategory] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [timeWindow, setTimeWindow] = useState(5);
  const [center, setCenter] = useState(0);
  const [halfspan, setHalfspan] = useState(1);

  // signal state: channels: array of channels (each channel is array of samples)
  const [time, setTime] = useState(Array.from({ length: 1000 }, (_, i) => i / 100));
  const [channels, setChannels] = useState(
    Array.from({ length: 8 }, (_, j) =>
      Array.from({ length: 1000 }, (_, i) => Math.sin(2 * Math.PI * 1 * (i / 100) + j / 2))
    )
  );

  const [error, setError] = useState("");
  const [selectedChannels, setSelectedChannels] = useState([...Array(8).keys()]);
  const fileRef = useRef(null);

  // NEW: sampling rate and loading
  const [samplingRate, setSamplingRate] = useState(256);
  const [loadingSignal, setLoadingSignal] = useState(false);
  const sliderDebounceRef = useRef(null);

  // -------------------------
  // CSV handler (existing)
  // -------------------------
  const handleCSVUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRawCsvFile(file);
    // preserve original CSV behavior
    if (!file.name.endsWith(".csv")) {
      setError("❌ Please upload a valid CSV file only!");
      return;
    }

    setError("");
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        const data = result.data || [];
        if (!data.length) {
          setError("⚠ The CSV file appears empty or invalid.");
          return;
        }

        // detect time column (common names) and EEG channel columns
        const headers = result.meta.fields || [];
        const timeCandidates = ["time", "t", "timestamp", "sample"];
        let timeField = headers.find(h => timeCandidates.includes(h.toLowerCase()));
        if (!timeField) timeField = headers[0]; // fallback to first column

        // Map EEG_LABELS to available columns
        const channelFields = EEG_LABELS.map(lbl => headers.find(h => h.toLowerCase() === lbl.toLowerCase()));

        // if any channel missing, try to take next 8 columns after timeField
        if (channelFields.some(f => !f)) {
          const idx = headers.indexOf(timeField);
          const fallback = headers.slice(idx + 1, idx + 1 + EEG_LABELS.length);
          for (let i = 0; i < EEG_LABELS.length; i++) {
            channelFields[i] = channelFields[i] || fallback[i] || null;
          }
        }

        const t = data.map(row => Number(row[timeField]));
        const ch = channelFields.map((f) => data.map(r => Number(r[f] ?? 0)));

        // if lengths mismatch or NaN, try to coerce by index
        if (t.some(isNaN)) {
          // fallback: create synthetic time index
          setTime(Array.from({ length: data.length }, (_, i) => i / 100));
        } else setTime(t);

        setChannels(ch);
      },
      error: () => setError("❌ Error reading the CSV file."),
    });
  };

  // -------------------------
  // EDF handler + fetch resampled signal from backend
  // -------------------------
  const handleEDFSelect = (file) => {
    if (!file) return;
    setEdfFile(file);
    // immediately request server for signal (default samplingRate)
    fetchSignalFromBackend(file, samplingRate);
  };

  const fetchSignalFromBackend = async (file, sr) => {
    if (!file) return;
    setLoadingSignal(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sampling_rate", sr);
      // ask backend to return resampled signal & times (backend must support this)
      formData.append("return_signal", "true");

      const res = await fetch("http://127.0.0.1:8000/api/eeg/edf/predict", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Server error ${res.status}`);
      }

      const data = await res.json();
      // if backend returned signal + times, update state
      if (data.signal && data.times) {
        // expected data.signal: channels x samples
        const sig = Array.isArray(data.signal[0]) ? data.signal : [data.signal];
        setChannels(sig);
        setTime(data.times);
        // update selectedChannels if out of range
        setSelectedChannels((prev) => prev.filter(i => i < sig.length));
      } else {
        // no signal returned — keep previous channels
        console.warn("Backend did not return signal/times; only prediction available.");
      }

      // if prediction returned, open overlay
      if (data.predicted_class !== undefined || data.probabilities) {
        setPredResult({
          predicted_class: data.predicted_class,
          confidence: data.confidence,
          probs: data.probabilities ? data.probabilities[0] : data.probs || null,
        });
        setPredOpen(true);
      }
    } catch (err) {
      console.error("Failed fetching EDF signal:", err);
      setError("Failed to fetch signal from server. See console for details.");
    } finally {
      setLoadingSignal(false);
    }
  };

  // wire the file input change to either CSV or EDF handler based on extension
  const handleFileInputChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".edf")) {
      // use EDF flow
      handleEDFSelect(file);
    } else if (name.endsWith(".csv")) {
      // CSV flow (existing)
      handleCSVUpload(event);
    } else {
      setError("Unsupported file type. Use .edf or .csv");
    }
  };

  // debounce sampling rate slider so we don't spam backend while dragging
  useEffect(() => {
    if (!edfFile) return;
    if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current);
    sliderDebounceRef.current = setTimeout(() => {
      fetchSignalFromBackend(edfFile, samplingRate);
    }, 250);
    return () => {
      if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current);
    };
  }, [samplingRate, edfFile]);

  // -------------------------
  // predict button (sends EDF if available otherwise CSV)
  // -------------------------
  const runEEGPredict = async () => {
  const fileToSend = edfFile || rawCsvFile;
  if (!fileToSend) {
    alert("📂 Please upload a file first!");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("file", fileToSend);
    if (edfFile) formData.append("sampling_rate", samplingRate);
    formData.append("return_signal", "true");

    const response = await fetch("http://127.0.0.1:8000/api/eeg/edf/predict", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(txt || `Server error ${res.status}`);

    }

    const data = await response.json();
    console.log("EEG Model Output:", data);

    if (data.signal && data.times) {
      setChannels(data.signal);
      setTime(data.times);
      setSelectedChannels((prev) => prev.filter(i => i < data.signal.length));
    }

    setPredResult({
      predicted_class: data.predicted_class,
      confidence: data.confidence,
      probs: data.probabilities || data.probs || null,
    });
    setPredOpen(true);

  } catch (err) {
    console.error(err);
    setPredResult({ error: "❌ Error contacting the prediction server." });
    setPredOpen(true);
  }
};

  const categories = [
    { id: 1, label: "Channels" },
    { id: 2, label: "Polar" },
    { id: 3, label: "Reoccurrence" },
    { id: 4, label: "XOR" }
  ];

  return (
    <div className="relative min-h-screen flex text-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900/80 backdrop-blur-md border-r border-indigo-700 flex flex-col p-4">
        <h2 className="text-xl font-semibold text-indigo-300 mb-4 text-center">EEG Channels</h2>

        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setSelectedChannels([...Array(8).keys()])}
            className="px-3 py-1 bg-indigo-600 rounded text-white text-sm"
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedChannels([])}
            className="px-3 py-1 bg-red-600 rounded text-white text-sm"
          >
            Deselect All
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {EEG_LABELS.map((label, i) => (
            <label key={i} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-indigo-800/30 cursor-pointer text-white">
              <input
                type="checkbox"
                checked={selectedChannels.includes(i)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSelectedChannels((prev) => {
                    if (checked) return [...prev, i];
                    return prev.filter((ch) => ch !== i);
                  });
                }}
                className="accent-indigo-500"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center">
        <Image src={HeroImage} alt="Background" fill priority className="object-cover object-center -z-10 brightness-[0.35]" />

        {/* Header */}
        <div className="w-full bg-gray-900/70 backdrop-blur-md border-b border-indigo-700 shadow-lg">
          <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between px-6 py-4">
            <h1 className="text-3xl md:text-4xl font-bold text-indigo-200 tracking-wide">EEG Viewer</h1>
            <div className="flex flex-wrap justify-center gap-2 mt-3 md:mt-0">
              {categories.map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setCategory(btn.id)}
                  className={`flex h-10 items-center gap-2.5 rounded-full px-6 text-base font-semibold transition-all ${
                    category === btn.id
                      ? "bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 text-white shadow-md scale-105"
                      : "bg-indigo-100/20 text-indigo-200 hover:bg-indigo-200/20"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 py-3 bg-gray-900/60 backdrop-blur-md text-white flex flex-wrap items-center gap-3 justify-center border-b border-indigo-700 w-full">
          <button
            onClick={() => setPlaying((p) => !p)}
            className={`px-4 py-2 rounded font-semibold ${playing ? "bg-red-600" : "bg-green-600"}`}
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>

          <div>
            <button onClick={() => fileRef.current?.click()} className="rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-6 py-2 font-semibold shadow-md hover:scale-105 transition-transform">
              📂 Load File
            </button>
            {/* accept both .csv and .edf, handler chooses flow */}
            <input ref={fileRef} type="file" accept=".csv,.edf" onChange={handleFileInputChange} className="hidden" />
            {error && <p className="text-red-400 font-medium text-sm mt-2">{error}</p>}
            {loadingSignal && <p className="text-sm text-yellow-300 mt-1">Loading signal...</p>}
          </div>

          <button
            onClick={runEEGPredict}
            className="px-6 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 shadow-md font-semibold"
          >
            🔮 Predict EEG
          </button>

          {/* Sampling rate slider (new) */}
          <div className="flex items-center gap-3 px-3">
            <label className="text-sm">Sampling Rate</label>
            <input
              type="range"
              min="64"
              max="512"
              step="16"
              value={samplingRate}
              onChange={(e) => setSamplingRate(Number(e.target.value))}
              className="w-56"
            />
            <div className="w-16 text-right">{samplingRate} Hz</div>
          </div>

          <label className="flex items-center gap-2">
            <span>Speed</span>
            <input
              type="range"
              min="0.2"
              max="5"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-48"
            />
            <span>{speed.toFixed(1)}×</span>
          </label>

          <label className="flex items-center gap-2">
            <span>Time Window</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={timeWindow}
              onChange={(e) => setTimeWindow(Number(e.target.value))}
              className="w-20 text-black rounded px-2 py-1"
            />
          </label>
        </div>

        {/* Main EEG Display */}
        <div className="flex-1 p-6 w-full overflow-auto">
          {category === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
              {channels.map((ch, i) => (
                selectedChannels.includes(i) && (
                  <div key={i} className="rounded-lg bg-[#161616]/90 border border-indigo-500/30 p-2" style={{ height: 220 }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm text-gray-200 font-medium">{EEG_LABELS[i] || `Lead ${i + 1}`}</div>
                    </div>
                    <div className="h-[180px] w-full">
                      <MiniSweep
                        time={time}
                        values={ch}
                        playing={playing}
                        speed={speed}
                        timeWindow={timeWindow}
                        center={center}
                        halfspan={halfspan}
                        color={`hsl(${(i * 30) % 360}, 85%, 60%)`}
                      />
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {category === 2 && (
            <PolarSweep
              time={time}
              channels={channels}
              selectedChannels={selectedChannels}
              playing={playing}
              speed={speed}
            />
          )}
          {category === 3 && (
            <ReoccurrenceGraph
              time={time}
              channels={channels}
              selectedChannels={selectedChannels}
              timeWindow={timeWindow}
              colorMap="#00ffff"
            />
          )}

          {category === 4 && (
            <XORSweep
              time={time}
              channels={channels}
              selectedChannels={selectedChannels}
              timeWindow={timeWindow}
              playing={playing}
              speed={speed}
            />
          )}
        </div>
      </div>
      <PredictOverlay
        open={predOpen}
        onClose={() => setPredOpen(false)}
        result={predResult}
      />
    </div>
  );
}
