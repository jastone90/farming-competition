"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const DECOY_SONGS = [
  { song: "Bohemian Rhapsody", artist: "Queen", genre: "Classic Rock" },
  { song: "Lose Yourself", artist: "Eminem", genre: "Hip Hop" },
  { song: "Hotel California", artist: "Eagles", genre: "Rock" },
  { song: "Blinding Lights", artist: "The Weeknd", genre: "Synth Pop" },
  { song: "Stairway to Heaven", artist: "Led Zeppelin", genre: "Rock" },
  { song: "Redbone", artist: "Childish Gambino", genre: "Funk" },
  { song: "Humble", artist: "Kendrick Lamar", genre: "Hip Hop" },
  { song: "Hey Ya!", artist: "OutKast", genre: "Pop Rap" },
  { song: "Mr. Brightside", artist: "The Killers", genre: "Indie Rock" },
  { song: "Scary Monsters", artist: "Skrillex", genre: "Dubstep" },
  { song: "Smells Like Teen Spirit", artist: "Nirvana", genre: "Grunge" },
  { song: "Take Five", artist: "Dave Brubeck", genre: "Jazz" },
  { song: "Clair de Lune", artist: "Debussy", genre: "Classical" },
  { song: "Get Lucky", artist: "Daft Punk", genre: "Disco" },
  { song: "Sicko Mode", artist: "Travis Scott", genre: "Trap" },
  { song: "Creep", artist: "Radiohead", genre: "Alt Rock" },
  { song: "Don't Stop Me Now", artist: "Queen", genre: "Rock" },
  { song: "Swimming Pools", artist: "Kendrick Lamar", genre: "Hip Hop" },
  { song: "Africa", artist: "Toto", genre: "Soft Rock" },
  { song: "Purple Rain", artist: "Prince", genre: "R&B" },
  { song: "Sunflower", artist: "Post Malone", genre: "Pop Rap" },
  { song: "One More Time", artist: "Daft Punk", genre: "House" },
  { song: "Black Skinhead", artist: "Kanye West", genre: "Hip Hop" },
  { song: "Superstition", artist: "Stevie Wonder", genre: "Funk" },
  { song: "Money Trees", artist: "Kendrick Lamar", genre: "Hip Hop" },
  { song: "Paint It Black", artist: "Rolling Stones", genre: "Rock" },
  { song: "River", artist: "Joni Mitchell", genre: "Folk" },
  { song: "Harder Better Faster", artist: "Daft Punk", genre: "Electronic" },
  { song: "m.A.A.d city", artist: "Kendrick Lamar", genre: "Hip Hop" },
  { song: "Levels", artist: "Avicii", genre: "EDM" },
  { song: "Georgia", artist: "Phoebe Bridgers", genre: "Indie" },
  { song: "Mask Off", artist: "Future", genre: "Trap" },
  { song: "Float On", artist: "Modest Mouse", genre: "Indie Rock" },
  { song: "The Less I Know", artist: "Tame Impala", genre: "Psychedelic" },
];

const SEARCH_MESSAGES = [
  "Scanning your vibe...",
  "Analyzing farming intensity...",
  "Cross-referencing SFU output with BPM...",
  "Consulting the algorithm...",
  "Evaluating 47 million tracks...",
  "Checking underground catalogs...",
  "Running neural taste model...",
  "Narrowing down genres...",
  "Almost there...",
  "Factoring in haybail rep count...",
  "This one's tricky...",
  "Digging deeper...",
  "Found something interesting...",
  "Wait no, keep looking...",
  "Recalibrating for farmer energy...",
  "Okay I think I got it...",
];

const FARM_EMOJIS = ["🌾", "🚜", "🐄", "🌽", "🐔", "🥕", "🌻", "🐴", "🍎", "🐑", "🌿", "🥬", "🐖", "🏇", "🦆", "🍂", "🌱", "🐐"];

interface FallingEmoji {
  id: number;
  emoji: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

const FINAL_SONG = { song: "Leglock", artist: "Shakewell" };

type Phase = "idle" | "searching" | "reveal" | "result";

export default function MusicPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentDecoy, setCurrentDecoy] = useState(DECOY_SONGS[0]);
  const [statusMsg, setStatusMsg] = useState(SEARCH_MESSAGES[0]);
  const [progress, setProgress] = useState(0);
  const [flickerFast, setFlickerFast] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const emojiIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const emojiIdRef = useRef(0);
  const [fallingEmojis, setFallingEmojis] = useState<FallingEmoji[]>([]);

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (emojiIntervalRef.current) clearInterval(emojiIntervalRef.current);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  function startSearch() {
    setPhase("searching");
    setProgress(0);
    setFlickerFast(false);
    setFallingEmojis([]);

    // Spawn falling emojis
    emojiIntervalRef.current = setInterval(() => {
      const newEmoji: FallingEmoji = {
        id: emojiIdRef.current++,
        emoji: FARM_EMOJIS[Math.floor(Math.random() * FARM_EMOJIS.length)],
        left: Math.random() > 0.5 ? Math.random() * 20 : 80 + Math.random() * 20,
        delay: 0,
        duration: 2 + Math.random() * 3,
        size: 16 + Math.floor(Math.random() * 24),
      };
      setFallingEmojis((prev) => [...prev.slice(-30), newEmoji]);
    }, 250);

    let tick = 0;
    const totalTicks = 90;

    intervalRef.current = setInterval(() => {
      tick++;
      const pct = Math.min((tick / totalTicks) * 100, 99);
      setProgress(pct);

      // Cycle decoy songs — faster as we progress
      setCurrentDecoy(DECOY_SONGS[Math.floor(Math.random() * DECOY_SONGS.length)]);

      // Cycle status messages
      const msgIdx = Math.min(
        Math.floor((tick / totalTicks) * SEARCH_MESSAGES.length),
        SEARCH_MESSAGES.length - 1
      );
      setStatusMsg(SEARCH_MESSAGES[msgIdx]);

      // Speed up flicker near the end
      if (tick > totalTicks * 0.75) {
        setFlickerFast(true);
      }

      if (tick >= totalTicks) {
        clearInterval(intervalRef.current);
        if (emojiIntervalRef.current) clearInterval(emojiIntervalRef.current);
        setProgress(100);
        timeoutRef.current = setTimeout(() => {
          setPhase("reveal");
          setTimeout(() => setPhase("result"), 3500);
        }, 600);
      }
    }, 100);
  }

  function reset() {
    cleanup();
    setPhase("idle");
    setProgress(0);
    setFallingEmojis([]);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center relative overflow-hidden min-h-[80vh]">
      {/* Falling emoji rain */}
      {fallingEmojis.length > 0 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {fallingEmojis.map((e) => (
            <span
              key={e.id}
              className="absolute animate-[fall_linear_forwards] opacity-60"
              style={{
                left: `${e.left}%`,
                fontSize: `${e.size}px`,
                animation: `fall ${e.duration}s linear forwards`,
                animationDelay: `${e.delay}s`,
              }}
            >
              {e.emoji}
            </span>
          ))}
          <style>{`
            @keyframes fall {
              0% { top: -40px; opacity: 0.7; transform: rotate(0deg); }
              100% { top: 110vh; opacity: 0; transform: rotate(${Math.random() > 0.5 ? '' : '-'}360deg); }
            }
          `}</style>
        </div>
      )}

      <div className="relative z-10">
      {phase === "idle" && (
        <div className="space-y-6">
          <div className="text-6xl">🎵</div>
          <h1 className="text-2xl font-bold">Farming Competition DJ</h1>
          <p className="text-muted-foreground text-sm">
            Need something to listen to while you farm? Our advanced algorithm
            will analyze your farming style and find the perfect track.
          </p>
          <button
            onClick={startSearch}
            className="px-6 py-3 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all hover:scale-105 active:scale-95"
          >
            Find me something to listen to
          </button>
        </div>
      )}

      {phase === "searching" && (
        <div className="space-y-8">
          <div className={`text-6xl ${flickerFast ? "animate-bounce" : "animate-pulse"}`}>
            🔍
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              {statusMsg}
            </p>

            {/* Progress bar */}
            <div className="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              {Math.round(progress)}% analyzed
            </p>
          </div>

          {/* Flickering decoy song */}
          <div className="border border-border rounded-lg p-4 bg-card min-h-[88px] flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Evaluating
            </p>
            <p className={`text-lg font-bold transition-opacity ${flickerFast ? "duration-75" : "duration-150"}`}>
              {currentDecoy.song}
            </p>
            <p className="text-sm text-muted-foreground">{currentDecoy.artist}</p>
            <span className="inline-block mx-auto mt-1 px-2 py-0.5 text-[10px] rounded-full bg-stone-100 dark:bg-stone-800 text-muted-foreground">
              {currentDecoy.genre}
            </span>
          </div>

          <p className="text-[10px] text-muted-foreground">
            {flickerFast ? "Locking in..." : "Rejecting..."}
          </p>
        </div>
      )}

      {phase === "reveal" && (
        <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
          <div className="text-6xl animate-pulse">🎧</div>
          <p className="text-lg font-bold animate-[fadeIn_0.3s_ease-out]">
            We found it.
          </p>
          <div className="animate-[fadeIn_0.8s_ease-out_0.6s_both]">
            <img
              src="/leglock.png"
              alt=""
              className="mx-auto w-48 h-48 object-cover rounded-xl shadow-2xl border-2 border-primary/30"
            />
          </div>
          <p className="text-sm text-muted-foreground animate-[fadeIn_1s_ease-out_1.4s_both]">
            Your next listen is...
          </p>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {phase === "result" && (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
          <div className="text-6xl">🔥</div>

          <div className="border-2 border-primary rounded-xl p-8 bg-card shadow-lg">
            <a
              href="https://www.youtube.com/watch?v=EGvrkmXcyGA"
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <img
                src="/leglock.png"
                alt=""
                className="mx-auto w-40 h-40 object-cover rounded-lg mb-4"
              />
              <p className="text-3xl font-black group-hover:text-primary transition-colors">
                {FINAL_SONG.song}
              </p>
              <p className="text-lg text-muted-foreground mt-1">by {FINAL_SONG.artist}</p>
              <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-full group-hover:bg-red-500 transition-colors">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.5.6c-1 .3-1.8 1-2.1 2C0 8.1 0 12 0 12s0 3.9.4 5.8c.3 1 1 1.8 2 2.1 1.9.6 9.5.6 9.5.6s7.6 0 9.5-.6c1-.3 1.8-1 2.1-2 .4-1.9.4-5.8.4-5.8s0-3.9-.4-5.8zM9.8 15.5V8.5l6.3 3.5-6.3 3.5z"/>
                </svg>
                Play on YouTube
              </span>
            </a>
          </div>

          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            After analyzing 47 million tracks across every genre, this is
            scientifically the optimal farming soundtrack for you right now.
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 text-xs font-medium border border-border rounded-lg hover:bg-accent transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
