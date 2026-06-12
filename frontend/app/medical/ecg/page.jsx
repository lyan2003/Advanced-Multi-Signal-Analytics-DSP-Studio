"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Papa from "papaparse";
import HeroImage from "@/public/images/home.jpg";

const LEAD_LABELS = [
  "ECG I", "ECG II", "ECG III", "ECG aVR",
  "ECG aVL", "ECG aVF", "ECG V1", "ECG V2",
  "ECG V3", "ECG V4", "ECG V5", "ECG V6",
];

const API_BASE = "http://127.0.0.1:8000";

/* ===========================
   Aliasing helpers (NO prefiltering)
=========================== */
const ECG_LEAD_NAMES = new Set([
  "i","ii","iii","avr","avl","avf","v1","v2","v3","v4","v5","v6"
]);

function isEcgLabel(label = "") {
  const s = String(label).trim().toLowerCase();
  if (s.startsWith("ecg")) return true;          // e.g. "ECG V3"
  const last = s.split(/\s+/).pop();             // take last token
  return ECG_LEAD_NAMES.has(last);
}

function median(arr) {
  if (!arr?.length) return NaN;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : 0.5 * (a[m - 1] + a[m]);
}

function estimateFsFromTime(t = []) {
  if (!t || t.length < 2) return NaN;
  const diffs = [];
  for (let i = 0; i < t.length - 1; i++) {
    const d = t[i + 1] - t[i];
    if (isFinite(d) && d > 0) diffs.push(d);
  }
  const dt = median(diffs);
  return dt > 0 ? 1 / dt : NaN;
}

function aliasOneArrayNoPrefilter(x, factor, targetLen) {
  if (factor <= 1) {
    const out = x.slice();
    if (targetLen != null && targetLen !== out.length) {
      const y = out.slice(0, targetLen);
      while (y.length < targetLen) y.push(out[out.length - 1]);
      return y;
    }
    return out;
  }
  // decimate (no prefilter)(sampling here)
  const dec = [];
  for (let i = 0; i < x.length; i += factor) dec.push(x[i]);

  if (targetLen == null) return dec;

  // naive nearest/hold upsample back to original length (upsample here)
  const rep = [];
  for (let i = 0; i < dec.length; i++) {
    for (let k = 0; k < factor; k++) rep.push(dec[i]);
  }
  if (rep.length > targetLen) return rep.slice(0, targetLen);
  while (rep.length < targetLen) rep.push(rep.length ? rep[rep.length - 1] : 0);
  return rep;
}

/**
 * Alias ECG channels only.
 * - Decimate ECG channels by factor = floor(originalFs/targetFs), NO prefilter (creates aliasing)
 * - Non-ECG channels unchanged
 * - If returnUpsampled=true: repeat/hold upsample to original length
 */
function aliasECGChannelsOnly(channels, channelNames, originalFs, targetFs, returnUpsampled = true) {
  if (!Array.isArray(channels) || channels.length === 0) return channels;
  const nCh = channels.length;
  const nSamp = channels[0]?.length ?? 0;
  if (!(originalFs > 0) || !(targetFs > 0) || nSamp === 0) return channels;
  //factor calculation
  let factor = Math.floor(originalFs / targetFs);
  if (factor < 1) factor = 1;

  const out = new Array(nCh);
  for (let ci = 0; ci < nCh; ci++) {
    const name = channelNames?.[ci] ?? `Lead ${ci + 1}`;
    const isEcg = isEcgLabel(name);
    if (!isEcg || factor === 1) {
      out[ci] = channels[ci].slice();
    } else {
      out[ci] = aliasOneArrayNoPrefilter(
        channels[ci],
        factor,
        returnUpsampled ? nSamp : undefined
      );
    }
  }
  return out;
}

/* ===========================
   Mini Sweep Canvas
=========================== */
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

      const ts = time?.[0] + (st.current.tCursor % wrapDur);
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

/* ===========================
   Polar Sweep
=========================== */
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

    // background
    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(200,200,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // angles
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
      const ts = time?.[0] + (st.current.tCursor % wrapDur);

      selectedChannels.forEach((chIndex) => {
        const val = interpAt(ts, channels[chIndex]);
        const minV = Math.min(...channels[chIndex]);
        const maxV = Math.max(...channels[chIndex]);
        const angle = 2 * Math.PI * ((ts - time[0]) / wrapDur);
        const r = ((val - minV) / (maxV - minV || 1)) * radius;
        const x = cx + r * Math.cos(angle - Math.PI / 2);
        const y = cy + r * Math.sin(angle - Math.PI / 2);
        if (!st.current.points[chIndex]) st.current.points[chIndex] = [];
        st.current.points[chIndex].push({ x, y });
      });
    }

    //channels draw
    selectedChannels.forEach((chIndex) => {
      ctx.strokeStyle = `hsl(${(chIndex * 30) % 360}, 85%, 60%)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      st.current.points[chIndex].forEach((p, i) => {
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

/* ===========================
   Reoccurrence Graph
=========================== */
function ReoccurrenceGraph({ time, channels, selectedChannels, timeWindow, colorMap }) {
  const canvasRef = useRef(null);
  const [pair, setPair] = useState({ chX: 0, chY: 1 }); // القناتين الافتراضيتين

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedChannels.length < 2) return;

    const ctx = canvas.getContext("2d");
    const w = (canvas.width = canvas.clientWidth);
    const h = (canvas.height = canvas.clientHeight);

    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, w, h);

    const chX = channels[pair.chX];
    const chY = channels[pair.chY];
    if (!chX || !chY) return;

    const n = Math.min(chX.length, chY.length);
    ctx.fillStyle = colorMap;

    const minX = Math.min(...chX), maxX = Math.max(...chX);
    const minY = Math.min(...chY), maxY = Math.max(...chY);

    for (let i = 0; i < n; i++) {
      const x = ((chX[i] - minX) / (maxX - minX || 1)) * w;
      const y = h - ((chY[i] - minY) / (maxY - minY || 1)) * h;
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
              <option key={i} value={i}>{`Lead ${i + 1}`}</option>
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
              <option key={i} value={i}>{`Lead ${i + 1}`}</option>
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

/* ===========================
   XOR Sweep
=========================== */
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
      selectedChannels.forEach((i) => (st.current.points[i] = []));
      st.current.tCursor = 0;
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpi, 0, 0, dpi, 0, 0);

    const w = wCSS, h = hCSS;
    const rx = 40, ry = 20, rw = w - 60, rh = h - 40;

    // خلفية
    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, w, h);

    if (playing) {
      const now = performance.now();
      const dtMs = now - st.current.prev;
      st.current.prev = now;
      const dtLogical = speed * (dtMs / 16.6667);
      st.current.tCursor += dtLogical;

      const chunkStart = time[0] + (st.current.tCursor % wrapDur);
      const chunkEnd = chunkStart + timeWindow;

      //chunks for each channel
      const chunk = selectedChannels.map((chIndex) => {
        return time.map((t, i) => {
          if (t >= chunkStart && t < chunkEnd) return channels[chIndex][i];
          return 0; // خارج chunk نعتبره صفر
        });
      });

      //XOR
      if (st.current.lastChunks.length > 0) {
        chunk.forEach((chArr, chIdx) => {
          for (let i = 0; i < chArr.length; i++) {
            const prevVal = st.current.lastChunks[chIdx][i];
            if (Math.abs(chArr[i] - prevVal) < 1e-6) chArr[i] = 0;
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

    selectedChannels.forEach((chIndex) => {
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

/* ===========================
   Predict Overlay
=========================== */
function PredictOverlay({ open, onClose, result }) {
  if (!open) return null;

  const ecgConditionLabels = [
    "1st degree AV block (1dAVb)",
    "Right Bundle Branch Block (RBBB)",
    "Left Bundle Branch Block (LBBB)",
    "Sinus Bradycardia (SB)",
    "Atrial Fibrillation (AF)",
    "Sinus Tachycardia (ST)",
    "Other",
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-96 shadow-lg border border-indigo-600">
        <h2 className="text-xl font-bold text-indigo-300 mb-4">Prediction Result</h2>

        {result?.error ? (
          <p className="text-red-400 font-medium">{result.error}</p>
        ) : (
          <ul className="space-y-1">
            {ecgConditionLabels.map((label, i) => (
              <li key={i} className="flex justify-between text-white">
                <span>{label}</span>
                <span className="font-mono">
                  {result.probs?.[i] !== undefined ? (result.probs[i] * 100).toFixed(1) + "%" : "-"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ===========================
   Main Page
=========================== */
export default function ECGPage() {
  const [predOpen, setPredOpen] = useState(false);
  const [predResult, setPredResult] = useState(null);
  const [predicting, setPredicting] = useState(false);

  const [category, setCategory] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [timeWindow, setTimeWindow] = useState(5);
  const [center, setCenter] = useState(0);
  const [halfspan, setHalfspan] = useState(1);

  const [time, setTime] = useState(Array.from({ length: 1000 }, (_, i) => i / 100));
  const [channels, setChannels] = useState(
    Array.from({ length: 12 }, (_, j) =>
      Array.from({ length: 1000 }, (_, i) => Math.sin(2 * Math.PI * 1 * (i / 100) + j / 2))
    )
  );

  const [error, setError] = useState("");
  const [selectedChannels, setSelectedChannels] = useState([...Array(12).keys()]);
  const fileRef = useRef(null);

  // ----- NEW: Aliasing (undersampling) slider -----
  const [aliasFs, setAliasFs] = useState(100); // Hz (will clamp to original Fs)



  useEffect(() => {
    // keep aliasFs sane whenever time vector changes
    const fs = estimateFsFromTime(time);
    if (fs && (aliasFs > fs || aliasFs < 10)) {
      setAliasFs(Math.max(10, Math.round(fs)));
    }
  }, [time]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCSVUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setError("❌ Please upload a valid CSV file only!");
      return;
    }

    setError("");
    Papa.parse(file, {
      complete: (result) => {
        const rows = (result.data || []).filter((r) => Array.isArray(r) && r.length > 1);
        if (!rows.length) {
          setError("⚠ The CSV file appears empty or invalid.");
          return;
        }
        const t = rows.slice(1).map((row) => Number(row[0]));
        const ch = [];
        for (let c = 1; c < rows[0].length; c++) {
          ch.push(rows.slice(1).map((row) => Number(row[c])));
        }
        setTime(t);
        setChannels(ch);
      },
      error: () => setError("❌ Error reading the CSV file."),
    });
  };

  const runECGPredict = async () => {
  try {
    if (!time?.length || !channels?.length) {
      alert("Please load a CSV file first.");
      return;
    }

    setPredicting(true);
    setPredResult(null);

    const header = ["time", ...LEAD_LABELS.slice(0, viewChannels.length)].join(",");
    const rows = time.map((t, i) => {
      const vals = viewChannels.map((ch) => ch[i]?.toFixed(6) ?? "");
      return [t.toFixed(6), ...vals].join(",");
    });
    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });

    const form = new FormData();
    form.append("file", blob, `aliased_${aliasFs}Hz.csv`);
    const res = await fetch(`${API_BASE}/api/predict`, { method: "POST", body: form });


    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    setPredResult(data);
    setPredOpen(true);
  } catch (e) {
    console.error(e);
    setPredResult({ error: String(e) });
  } finally {
    setPredicting(false);
  }
};

  const downloadCSV = () => {
    if (!time?.length || !viewChannels?.length) {
      alert("No data available to save. Please load a CSV first.");
      return;
    }

    const header = ["time", ...LEAD_LABELS.slice(0, viewChannels.length)].join(",");

    const rows = time.map((t, i) => {
      const vals = viewChannels.map((ch) => ch[i]?.toFixed(6) ?? "");
      return [t.toFixed(6), ...vals].join(",");
    });

    const csvContent = [header, ...rows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ECG_Aliased_${aliasFs}Hz.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const categories = [
    { id: 1, label: "Channels" },
    { id: 2, label: "Polar" },
    { id: 3, label: "Reoccurrence" },
    { id: 4, label: "XOR" }
  ];

  // 🔁 Auto-predict when aliasing frequency changes
    useEffect(() => {
      if (!fileRef.current?.files?.[0]) return;
      if (!time?.length) return;
      const timeout = setTimeout(() => {
        runECGPredict();
      }, 700);
      return () => clearTimeout(timeout);
    }, [aliasFs]);

  // Compute view channels with aliasing applied (undersampling) to ECG only
  const originalFs = estimateFsFromTime(time) || 500;
  const maxFsUI = Math.max(10, Math.floor(originalFs));
  const viewChannels = aliasECGChannelsOnly(channels, LEAD_LABELS, originalFs, aliasFs, true);

  return (
    <div className="relative min-h-screen flex text-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900/80 backdrop-blur-md border-r border-indigo-700 flex flex-col p-4">
        <h2 className="text-xl font-semibold text-indigo-300 mb-4 text-center">ECG Channels</h2>

        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setSelectedChannels([...Array(12).keys()])}
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
          {LEAD_LABELS.map((label, i) => (
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
            <h1 className="text-3xl md:text-4xl font-bold text-indigo-200 tracking-wide">ECG Viewer</h1>
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
            className={`px-4 py-2 rounded font-semibold ${
              playing ? "bg-red-600" : "bg-green-600"
            }`}
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>

          <div>
            <button onClick={() => fileRef.current?.click()} className="rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-6 py-2 font-semibold shadow-md hover:scale-105 transition-transform">
              📂 Load CSV File
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
            {error && <p className="text-red-400 font-medium text-sm mt-2">{error}</p>}
          </div>

          <div>
            <button
              onClick={runECGPredict}
              className="ml-2 rounded-full bg-gradient-to-r from-green-500 to-green-400 text-white px-6 py-2 font-semibold shadow-md hover:scale-105 transition-transform"
              disabled={predicting}
            >
              {predicting ? "⏳ Predicting..." : "⚡ Predict"}
            </button>
          </div>
          <div>
          <button
            onClick={downloadCSV}
            className="ml-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 text-white px-6 py-2 font-semibold shadow-md hover:scale-105 transition-transform"
          >
            💾 Save CSV
          </button>
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

          {/* ---- NEW: Aliasing (undersampling) slider ---- */}
          <div className="w-px h-6 bg-white/20 mx-2" />
          <label className="flex items-center gap-2">
            <span>Aliasing Fs</span>
            <input
              type="range"
              min="10"
              max={maxFsUI}
              step="5"
              value={Math.min(aliasFs, maxFsUI)}
              onChange={(e) => setAliasFs(Number(e.target.value))}
              className="w-48"
              title="Undersampling frequency (Hz). Lower = stronger aliasing."
            />
            <span>{Math.min(aliasFs, maxFsUI)} Hz</span>
          </label>
          <span className="text-xs text-white/70">(Original ≈ {Math.round(originalFs)} Hz)</span>
        </div>

        {/* Main ECG Display */}
        <div className="flex-1 p-6 w-full overflow-auto">
          {category === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {viewChannels.map((ch, i) => (
                selectedChannels.includes(i) && (
                  <div key={i} className="rounded-lg bg-[#161616]/90 border border-indigo-500/30 p-2" style={{ height: 220 }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm text-gray-200 font-medium">{LEAD_LABELS[i] || `Lead ${i + 1}`}</div>
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
              channels={viewChannels}
              selectedChannels={selectedChannels}
              playing={playing}
              speed={speed}
            />
          )}

          {category === 3 && (
            <ReoccurrenceGraph
              time={time}
              channels={viewChannels}
              selectedChannels={selectedChannels}
              timeWindow={timeWindow}
              colorMap="#00ffff"
            />
          )}

          {category === 4 && (
            <XORSweep
              time={time}
              channels={viewChannels}
              selectedChannels={selectedChannels}
              timeWindow={timeWindow}
              playing={playing}
              speed={speed}
            />
          )}
        </div>
      </div>

      {/* Overlay */}
      <PredictOverlay
        open={predOpen}
        onClose={() => setPredOpen(false)}
        result={predResult}
      />
    </div>
  );
}
