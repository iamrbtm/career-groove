"use client";
import { useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, SkipForward, Volume2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const tracks = [
  { name: "Ambient Voyager", artist: "Orange Free Sounds", url: "https://www.orangefreesounds.com/wp-content/uploads/2015/04/Ambient-voyager-chillout-music.mp3" },
  { name: "Forgiven", artist: "Orange Free Sounds", url: "https://www.orangefreesounds.com/wp-content/uploads/2015/05/Forgiven-electronic-lounge-music.mp3" },
  { name: "December", artist: "Orange Free Sounds", url: "https://www.orangefreesounds.com/wp-content/uploads/2015/02/December.mp3" },
  { name: "East", artist: "Orange Free Sounds", url: "https://www.orangefreesounds.com/wp-content/uploads/2015/03/East-poppy-electro-ambient-track.mp3" },
];

export function MusicPlayer() {
  const audio = useRef<HTMLAudioElement>(null);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [track, setTrack] = useState(0);
  const [volume, setVolume] = useState(0.5);

  useEffect(() => {
    if (!audio.current) return;
    audio.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audio.current) return;
    if (playing) {
      audio.current.src = tracks[track].url;
      audio.current.play().catch(() => setPlaying(false));
    }
  }, [track]);

  const toggle = async () => {
    if (!audio.current) return;
    if (playing) {
      audio.current.pause();
      setPlaying(false);
    } else {
      audio.current.src = tracks[track].url;
      try {
        await audio.current.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  };

  const skip = async () => {
    const next = (track + 1) % tracks.length;
    setTrack(next);
    if (playing && audio.current) {
      audio.current.src = tracks[next].url;
      try {
        await audio.current.play();
      } catch {
        setPlaying(false);
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-24 left-5 z-40 grid size-14 place-items-center rounded-full border-2 border-ink bg-mint shadow-[0_4px_0_#26312c] transition-transform active:translate-y-0.5 active:shadow-none md:bottom-8"
        aria-label={open ? "Close music player" : "Open music player"}
      >
        {open ? <X size={24} className="text-ink" /> : <Headphones size={24} className="text-ink" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-40 left-4 z-40 w-[300px] rounded-3xl border-2 border-ink bg-white shadow-[0_8px_0_#26312c] md:bottom-24 md:left-5"
          >
            <div className="flex items-center gap-3 border-b-2 border-ink/10 px-4 py-3">
              <div className="grid size-8 place-items-center rounded-xl bg-mint">
                <Headphones size={16} className="text-ink" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">Now Grooving</p>
                <p className="truncate text-[10px] font-bold text-ink/50">{tracks[track].name} &middot; {tracks[track].artist}</p>
              </div>
            </div>

            <div className="space-y-3 px-4 py-4">
              <audio ref={audio} preload="none" onEnded={() => skip()} />

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={playing ? "Pause music" : "Play music"}
                  className="grid size-12 place-items-center rounded-full bg-sun shadow-[0_3px_0_#26312c] active:translate-y-0.5 active:shadow-none"
                >
                  {playing ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={skip}
                  aria-label="Next track"
                  className="grid size-10 place-items-center rounded-full bg-cream border-2 border-ink"
                >
                  <SkipForward size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Volume2 size={14} className="text-ink/40" />
                <input
                  className="h-1.5 w-full appearance-none rounded-full bg-ink/10 accent-coral"
                  aria-label="Volume"
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1 pt-1">
                {tracks.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setTrack(i); if (playing && audio.current) { audio.current.src = t.url; audio.current.play().catch(() => setPlaying(false)); } }}
                    className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-xs font-bold transition-colors ${
                      track === i ? "bg-mint/30 border-2 border-ink" : "bg-ink/5 hover:bg-ink/10"
                    }`}
                  >
                    <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${
                      track === i && playing ? "bg-ink text-white" : "bg-ink/10"
                    }`}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className="shrink-0 text-[10px] text-ink/40">{t.artist}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
