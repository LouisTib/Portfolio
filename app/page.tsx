import PuzzleScene from "@/components/PuzzleScene";

export default function Home() {
  return (
    <main className="w-screen h-screen relative bg-white overflow-hidden">
      {/* 3D SCENE */}
      <PuzzleScene />

      {/* UI OVERLAY */}
      <div className="absolute inset-0 pointer-events-none">
        {/* TOP LEFT INFO */}
        <div className="absolute top-10 left-10 text-black">
          <h1 className="text-4xl font-bold tracking-tight">Your Name</h1>

          <p className="text-black/60 mt-1">Creative Developer</p>

          {/* SOCIALS */}
          <div className="flex gap-4 mt-4 text-sm pointer-events-auto">
            <a
              href="https://instagram.com"
              target="_blank"
              className="text-black/70 hover:text-black transition"
            >
              Instagram
            </a>

            <a
              href="https://github.com"
              target="_blank"
              className="text-black/70 hover:text-black transition"
            >
              GitHub
            </a>

            <a
              href="mailto:youremail@example.com"
              className="text-black/70 hover:text-black transition"
            >
              Email
            </a>

            <a
              href="https://linkedin.com"
              target="_blank"
              className="text-black/70 hover:text-black transition"
            >
              LinkedIn
            </a>
          </div>
        </div>

        {/* BOTTOM CONTROLS (MOVED LOWER) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
          <div className="flex gap-4 pointer-events-auto">
            <button className="px-6 py-2 rounded-full bg-black text-white hover:opacity-80 transition">
              Shuffle
            </button>

            <button className="px-6 py-2 rounded-full border border-black text-black hover:bg-black hover:text-white transition">
              Solve
            </button>
          </div>

          {/* CAPS TEXT */}
          <p className="text-sm text-black/60 uppercase tracking-wide">
            drag to rotate • scroll to zoom
          </p>
        </div>
      </div>
    </main>
  );
}
