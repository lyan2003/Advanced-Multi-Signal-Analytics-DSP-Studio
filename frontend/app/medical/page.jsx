"use client";
import Image from "next/image";
import Link from "next/link";
import HeroImage from "@/public/images/med_view_page.jpg";
import PageIllustration from "@/components/page-illustration";
import logo from "@/public/images/logo.svg";

export default function HeroHome() {
  return (
    <section>
      {/* ===== Top Bar (Navbar) ===== */}
      <div className="w-full bg-gray-900/90 backdrop-blur-md border-b border-gray-700 shadow-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          {/* ===== Left side: Logo and Title ===== */}
          <div className="flex items-center gap-3">
            <PageIllustration />
            <Image
              src={logo}
              alt="Medical Signal Logo"
              width={50}
              height={50}
              className="rounded-full shadow-md"
            />
            <h1 className="text-2xl md:text-5xl font-semibold text-indigo-300">
              Medical Signals Viewer
            </h1>
          </div>

          {/* ===== Right side: Buttons ===== */}
          <div className="flex items-center gap-4">
            <Link
              href="/medical/ecg"
              className="px-15 py-3 rounded-lg text-3xl font-semibold bg-indigo-600 text-white shadow-md shadow-indigo-400/30 hover:bg-indigo-700 transition-all duration-300"
            >
              ECG
            </Link>
            <Link
              href="/medical/eeg"
              className="px-15 py-3 rounded-lg text-3xl font-semibold bg-gray-800 text-indigo-200 hover:bg-gray-700 transition-all duration-300"
            >
              EEG
            </Link>
          </div>
        </div>
      </div>

      {/* ===== Hero Image ===== */}
      <div className="mx-auto max-w-4xl mt-12 px-4 sm:px-6 text-center">
        <Image
          src={HeroImage}
          alt="Signella main visual"
          width={1104}
          height={576}
          className="mx-auto rounded-2xl shadow-lg"
        />

        {/* ===== Description Text ===== */}
        <div className="mt-10 bg-gray-800/60 backdrop-blur-md text-gray-200 rounded-2xl p-8 shadow-lg max-w-4xl mx-auto">
          <p className="text-lg leading-relaxed">
            The <span className="font-semibold text-indigo-300">Medical Signals Viewer</span> provides an integrated platform for analyzing both
            <span className="font-semibold"> ECG </span> and
            <span className="font-semibold"> EEG </span> signals. While the ECG reveals the heart’s electrical activity—helping detect arrhythmias and cardiac abnormalities—the EEG records brain waves that reflect neural activity and cognitive states.
            Together, these signals offer a comprehensive view of human physiological function, supporting clinical diagnosis and biomedical research.
          </p>
        </div>
      </div>
    </section>
  );
}