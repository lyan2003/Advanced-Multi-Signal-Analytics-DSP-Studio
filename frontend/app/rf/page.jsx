"use client";
import React, { useRef, useState } from "react";
import Image from "next/image";
import HeroImage from "@/public/images/workflow-01.png";

export default function SARViewer() {
  const [stats, setStats] = useState({ mean: 0, min: 0, max: 0 });
  const [jetURL, setJetURL] = useState(null);
  const [origURL, setOrigURL] = useState(null);
  const [hist, setHist] = useState([]);
  const previewRef = useRef(null);
  const histRef = useRef(null);
  const hiddenRef = useRef(null);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const jetColor = (v) => {
    const x = v / 255;
    const r = clamp(1.5 - Math.abs(4 * x - 3), 0, 1);
    const g = clamp(1.5 - Math.abs(4 * x - 2), 0, 1);
    const b = clamp(1.5 - Math.abs(4 * x - 1), 0, 1);
    return [Math.round(255 * r), Math.round(255 * g), Math.round(255 * b)];
  };

  const handleFile = async (file) => {
    const bmp = await createImageBitmap(file);
    const maxW = 800;
    const scale = Math.min(1, maxW / bmp.width);
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);

    const hc = hiddenRef.current;
    hc.width = w;
    hc.height = h;
    const hctx = hc.getContext("2d", { willReadFrequently: true });
    hctx.clearRect(0, 0, w, h);
    hctx.drawImage(bmp, 0, 0, w, h);

    const img = hctx.getImageData(0, 0, w, h);
    const data = img.data;
    const bins = new Array(256).fill(0);
    let s = 0,
      mn = 255,
      mx = 0;
    const N = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const y = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
      bins[y]++;
      s += y;
      if (y < mn) mn = y;
      if (y > mx) mx = y;
    }

    setStats({ mean: (s / N).toFixed(1), min: mn, max: mx });
    setHist(bins);

    const pv = previewRef.current;
    pv.width = w;
    pv.height = h;
    const pctx = pv.getContext("2d");
    pctx.clearRect(0, 0, w, h);
    pctx.drawImage(hc, 0, 0);

    pctx.strokeStyle = "rgba(255,255,255,0.5)";
    pctx.lineWidth = 10;
    pctx.strokeRect(0, 0, w, h);

    setOrigURL(URL.createObjectURL(file));

    const jetImg = hctx.createImageData(w, h);
    for (let i = 0, j = 0; i < N; ++i, j += 4) {
      const y = Math.round(
        0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]
      );
      const [jr, jg, jb] = jetColor(y);
      jetImg.data[j] = jr;
      jetImg.data[j + 1] = jg;
      jetImg.data[j + 2] = jb;
      jetImg.data[j + 3] = 255;
    }
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    off.getContext("2d").putImageData(jetImg, 0, 0);
    setJetURL(off.toDataURL("image/png"));

    drawHistogram(bins);
  };

  const drawHistogram = (bins) => {
    const canvas = histRef.current;
    const ctx = canvas.getContext("2d");
    const w = 800;
    const h = 350;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    const maxCount = Math.max(...bins);
    ctx.fillStyle = "#1e88e5";
    for (let i = 0; i < 256; i++) {
      const x = (i / 256) * w;
      const barHeight = (bins[i] / maxCount) * (h - 50);
      ctx.fillRect(x, h - barHeight - 30, w / 256, barHeight);
    }

    ctx.strokeStyle = "#aaa";
    ctx.strokeRect(0, 0, w, h);

    ctx.fillStyle = "#ccc";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i <= 255; i += 32) {
      const x = (i / 256) * w;
      ctx.fillText(i.toString(), x, h - 10);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 5; i++) {
      const y = h - 30 - (i / 5) * (h - 50);
      const value = Math.round((maxCount * i) / 5);
      ctx.fillText(value.toString(), 10, y);
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.stroke();
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center relative min-h-screen text-gray-100 overflow-hidden">
      {/* HeroImage */}
      <Image
        src={HeroImage}
        alt="Background"
        fill
        priority
        className="object-cover object-center -z-10 brightness-[0.35]"
      />

      {/* Header */}
      <header className="w-full bg-gray-900/70 backdrop-blur-md border-b border-indigo-700 shadow-lg">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between px-6 py-4">
          <h1 className="text-3xl md:text-4xl font-bold text-indigo-200 tracking-wide">
            SAR Image Viewer
          </h1>
          <div className="flex flex-wrap justify-center gap-2 mt-3 md:mt-0">
          </div>
        </div>
      </header>

      {/* content */}
      <div className="w-full max-w-6xl p-6 mt-8">
        <label className="inline-block bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg cursor-pointer mb-4">
          Upload SAR Image
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            hidden
          />
        </label>

        {origURL && (
          <p className="text-sm text-indigo-200 mb-4">
            Mean: <b>{stats.mean}</b> | Min: {stats.min} | Max: {stats.max}
          </p>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg mb-2 text-indigo-300">Original Image</h2>
            <canvas
              ref={previewRef}
              className="rounded-lg shadow-md border border-gray-700 bg-gray-800 bg-opacity-30"
            />
          </div>

          <div>
            <h2 className="text-lg mb-2 text-indigo-300">Histogram</h2>
            <canvas
              ref={histRef}
              className="rounded-lg shadow-lg border border-gray-700 bg-gray-800 bg-opacity-40 w-full"
              style={{ height: "360px" }}
            />
          </div>
        </div>

        {jetURL && (
          <div className="mt-8">
            <h2 className="text-lg mb-2 text-indigo-300">
              Jet-colored (Pseudo-color)
            </h2>
            <img
              src={jetURL}
              alt="Jet view"
              className="rounded-lg shadow-md border border-gray-700"
            />
          </div>
        )}

        <canvas ref={hiddenRef} style={{ display: "none" }} />
      </div>
    </main>
  );
}
