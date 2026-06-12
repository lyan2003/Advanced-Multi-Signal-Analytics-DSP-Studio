import Image from "next/image";
import BlurredShape from "@/public/images/blurred-shape.svg";

export default function Cta() {
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -z-10 -mb-24 ml-20 -translate-x-1/2"
        aria-hidden="true"
      >
        <Image
          className="max-w-none"
          src={BlurredShape}
          width={760}
          height={668}
          alt="Blurred shape"
        />
      </div>


      <div className="max-w6xl mx-auto px-4 sm:px-6">
        <div className="bg-linear-to-r from-transparent via-gray-800/50 py-12 md:py-20">
          <div className="mx-auto max-w-3xl text-center">

            {/*  Our Team */}
            <div data-aos="fade-up" className="mb-8">
              <h3 className="text-2xl font-semibold text-white mb-4">Our Team</h3>
              <p className="text-gray-300 leading-relaxed">
                We are a multidisciplinary group of biomedical engineers, developers, and researchers
                passionate about bridging technology and healthcare. Together, we aim to create
                intelligent, accessible, and impactful tools that advance biomedical signal analysis
                and enhance learning experiences.
              </p>
            </div>


            <h2
              className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text pb-8 font-nacelle text-3xl font-semibold text-transparent md:text-4xl"
              data-aos="fade-up"
            >
              Join the content-first platform
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
}