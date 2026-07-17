"use client";
import { useRef, useState } from "react";
import { Headphones, Pause, Play, SkipForward, Volume2 } from "lucide-react";
import { motion } from "framer-motion";

const stations = [
  { name: "Lo-Fi", url: "https://stream.zeno.fm/f3wvbbqmdg8uv" },
  { name: "Ambient", url: "https://stream.zeno.fm/0r0xa792kwzuv" },
  { name: "Classical", url: "https://stream.zeno.fm/5u1qrv9u0uhvv" },
  { name: "Brain Waves", url: "https://stream.zeno.fm/9k1z52q5mg0uv" },
];

export function MusicPlayer() {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [station, setStation] = useState(0);
  const toggle = async () => { if (!audio.current) return; playing ? audio.current.pause() : await audio.current.play(); setPlaying(!playing); };
  const skip = async () => { const next = (station + 1) % stations.length; setStation(next); if (audio.current) { audio.current.src = stations[next].url; if (playing) await audio.current.play(); } };
  return <motion.div layout className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border-2 border-ink bg-white p-2 pr-4 shadow-pop md:bottom-6">
    <audio ref={audio} src={stations[station].url} preload="none" />
    <button onClick={toggle} aria-label={playing ? "Pause music" : "Play music"} className="grid size-10 place-items-center rounded-full bg-sun">{playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}</button>
    <div className="hidden min-w-20 sm:block"><p className="text-[10px] font-black uppercase tracking-widest text-plum">Now grooving</p><p className="text-sm font-bold">{stations[station].name}</p></div>
    <button onClick={skip} aria-label="Next station"><SkipForward size={18} /></button>
    <Volume2 size={16} className="hidden sm:block" /><input className="hidden w-16 accent-coral sm:block" aria-label="Volume" type="range" min="0" max="1" step=".1" defaultValue=".5" onChange={(e) => { if (audio.current) audio.current.volume = Number(e.target.value); }} />
    <Headphones size={18} className="sm:hidden" />
  </motion.div>;
}
