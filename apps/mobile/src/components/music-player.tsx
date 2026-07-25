import { useQuery } from "@tanstack/react-query";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pause, Play, SkipForward } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors, shadows } from "@/design/theme";
import { apiJson } from "@/lib/api";

const stations = [
  { name: "Lo-Fi", url: "https://stream.zeno.fm/f3wvbbqmdg8uv" },
  { name: "Ambient", url: "https://stream.zeno.fm/0r0xa792kwzuv" },
  { name: "Classical", url: "https://stream.zeno.fm/5u1qrv9u0uhvv" },
  { name: "Brain Waves", url: "https://stream.zeno.fm/9k1z52q5mg0uv" },
] as const;

export function MusicPlayer() {
  const settings = useQuery({
    queryFn: () => apiJson<{ settings: { musicStation?: string } }>("/api/settings"),
    queryKey: ["settings"],
  });
  const initialIndex = Math.max(
    0,
    stations.findIndex((station) => station.name === settings.data?.settings.musicStation),
  );
  const [stationIndex, setStationIndex] = useState(initialIndex);
  const player = useAudioPlayer(stations[0].url, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    const index = stations.findIndex(
      (station) => station.name === settings.data?.settings.musicStation,
    );
    if (index >= 0 && index !== stationIndex) {
      setStationIndex(index);
      player.replace(stations[index].url);
    }
  }, [player, settings.data, stationIndex]);

  function next() {
    const wasPlaying = status.playing;
    const nextIndex = (stationIndex + 1) % stations.length;
    setStationIndex(nextIndex);
    player.replace(stations[nextIndex].url);
    if (wasPlaying) player.play();
    void apiJson("/api/settings", {
      body: JSON.stringify({ musicStation: stations[nextIndex].name }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    }).catch(() => undefined);
  }

  return (
    <View
      accessibilityLabel={`Music station: ${stations[stationIndex].name}`}
      className="absolute bottom-20 right-4 flex-row items-center gap-2 rounded-full border-2 border-ink/10 bg-white p-2 pr-4"
      style={shadows.pop}
    >
      <Pressable
        accessibilityLabel={status.playing ? "Pause music" : "Play music"}
        accessibilityRole="button"
        className="h-10 w-10 items-center justify-center rounded-full bg-sunshine"
        onPress={() => (status.playing ? player.pause() : player.play())}
      >
        {status.playing ? <Pause color={colors.ink} size={18} /> : <Play color={colors.ink} size={18} />}
      </Pressable>
      <View className="hidden min-w-20 sm:flex">
        <Text className="text-[10px] font-black uppercase tracking-widest text-plum">Now grooving</Text>
        <Text className="font-bold text-ink">{stations[stationIndex].name}</Text>
      </View>
      <Pressable accessibilityLabel="Next music station" accessibilityRole="button" onPress={next}>
        <SkipForward color={colors.ink} size={18} />
      </Pressable>
    </View>
  );
}
