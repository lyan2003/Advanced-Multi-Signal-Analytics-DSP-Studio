import Image from "next/image";
import HeroImage from "@/public/images/home.jpg";
import Header from "@/components/ui/header";


export default function HeroHome() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero content */}
        <div className="py-12 md:py-20">
          {/* Section header */}
          <div className="pb-12 text-center md:pb-20">
            <h1
              className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text pb-5 font-nacelle text-4xl font-semibold text-transparent md:text-5xl"
              data-aos="fade-up"
            >
              🪄 Signella Viewer
            </h1>


            <div className="mx-auto max-w-6xl" data-aos="fade-up" data-aos-delay={200}>
              <p
                className="w-full px-8 py-6 text-xl text-indigo-200/70 text-justify leading-relaxed"
              >
                Signella is an interactive signal visualization platform designed to display and analyze diverse types of biomedical and physical signals, including ECG, EEG, sound waves, and radar data.
                The platform aims to provide an intuitive and unified interface that helps users observe, compare, and interpret signal behaviors in real time.
                By combining simplicity in design with precision in visualization, Signella serves as an educational and analytical tool for students, researchers, and engineers in the biomedical and signal processing fields.
              </p>
            </div>

          </div>


          <div className="mx-auto max-w-6xl" data-aos="fade-up" data-aos-delay={800}>
            <Image
              src={HeroImage}
              alt="Signella main visual"
              width={1104}
              height={576}
              className="mx-auto rounded-2xl shadow-lg"
            />
          </div>
        </div>
      </div>
    </section>
  );
}