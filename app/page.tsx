"use client";

import { useRef, useState, useEffect } from "react";
import PuzzleScene from "@/components/PuzzleScene";
import { PuzzleHandle } from "@/components/Puzzle";

function IconMail() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  );
}
function IconLinkedIn() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
function IconGitHub() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}
function IconInstagram() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
function IconShuffle() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    </svg>
  );
}
function IconExplode() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export default function Home() {
  const puzzleRef = useRef<PuzzleHandle>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let raf: number;
    function poll() {
      setBusy(puzzleRef.current?.isBusy() ?? false);
      raf = requestAnimationFrame(poll);
    }
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  const iconBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: "1px solid rgba(0,0,0,0.15)",
    backgroundColor: "rgba(255,255,255,0.6)",
    color: "rgba(0,0,0,0.65)",
    backdropFilter: "blur(4px)",
    transition: "all 0.15s ease",
  };

  const pillBtn = (dark: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 22px",
    borderRadius: 9999,
    backgroundColor: dark ? "#111" : "#fff",
    color: dark ? "#fff" : "#111",
    border: dark ? "none" : "1px solid rgba(0,0,0,0.15)",
    cursor: busy ? "not-allowed" : "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
    fontFamily: "var(--font-geist-sans), Arial, sans-serif",
    opacity: busy ? 0.45 : 1,
    transition: "opacity 0.15s",
  });

  const hoverDim = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!busy) (e.currentTarget as HTMLElement).style.opacity = "0.8";
  };
  const hoverReset = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!busy) (e.currentTarget as HTMLElement).style.opacity = "1";
  };

  return (
    <main
      style={{ backgroundColor: "#efefef" }}
      className="w-screen h-screen relative overflow-hidden"
    >
      <PuzzleScene puzzleRef={puzzleRef} />

      <div className="absolute inset-0 pointer-events-none">
        {/* TOP LEFT */}
        <div
          className="absolute top-8 left-8 text-black fall-in"
          style={{ animationDelay: "0ms" }}
        >
          <h1
            style={{
              fontFamily: "var(--font-geist-sans), Arial, sans-serif",
              fontSize: "2rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            LOUIS TIBOLDO
          </h1>
          <p
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              color: "rgba(0,0,0,0.5)",
              marginTop: "6px",
              textTransform: "uppercase",
            }}
          >
            MAKER&nbsp;•&nbsp;ENGINEER&nbsp;•&nbsp;INVENTOR
          </p>
          <div className="flex gap-2 mt-4 pointer-events-auto">
            {[
              { href: "mailto:you@example.com", icon: <IconMail /> },
              { href: "https://linkedin.com", icon: <IconLinkedIn /> },
              { href: "https://github.com", icon: <IconGitHub /> },
              { href: "https://instagram.com", icon: <IconInstagram /> },
            ].map(({ href, icon }, i) => (
              <a
                key={i}
                href={href}
                target={href.startsWith("mailto") ? undefined : "_blank"}
                rel="noopener noreferrer"
                style={{ ...iconBtnStyle, animationDelay: `${120 + i * 60}ms` }}
                className="fall-in"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "rgba(0,0,0,0.08)";
                  (e.currentTarget as HTMLElement).style.color = "black";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "rgba(255,255,255,0.6)";
                  (e.currentTarget as HTMLElement).style.color =
                    "rgba(0,0,0,0.65)";
                }}
              >
                {icon}
              </a>
            ))}
          </div>
        </div>

        {/* BOTTOM CONTROLS */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto fall-in"
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (!busy) puzzleRef.current?.shuffle();
              }}
              disabled={busy}
              style={pillBtn(true)}
              onMouseEnter={hoverDim}
              onMouseLeave={hoverReset}
            >
              <IconShuffle />
              Shuffle
            </button>

            <button
              onClick={() => {
                if (!busy) puzzleRef.current?.solve();
              }}
              disabled={busy}
              style={pillBtn(false)}
              onMouseEnter={hoverDim}
              onMouseLeave={hoverReset}
            >
              <IconRefresh />
              Solve
            </button>

            <button
              onClick={() => {
                if (!busy) puzzleRef.current?.explode();
              }}
              disabled={busy}
              style={pillBtn(false)}
              onMouseEnter={hoverDim}
              onMouseLeave={hoverReset}
            >
              <IconExplode />
              Explode
            </button>
          </div>

          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(0,0,0,0.4)",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            DRAG TO ROTATE&nbsp;•&nbsp;SCROLL TO ZOOM
          </p>
        </div>
      </div>
    </main>
  );
}
