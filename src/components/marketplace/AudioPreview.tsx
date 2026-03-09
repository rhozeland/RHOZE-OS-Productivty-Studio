import { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface AudioPreviewProps {
  src: string;
  title?: string;
  compact?: boolean;
}

const AudioPreview = ({ src, title, compact = false }: AudioPreviewProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onLoad = () => setDuration(audio.duration);
    const onEnd = () => { setPlaying(false); setProgress(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoad);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoad);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 ${compact ? "p-2" : "p-3 bg-muted/50 rounded-xl"}`}>
      <audio ref={audioRef} src={src} muted={muted} preload="metadata" />
      <button
        onClick={toggle}
        className="flex-shrink-0 h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        {title && !compact && (
          <p className="text-xs font-medium text-foreground truncate">{title}</p>
        )}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-1.5 bg-border rounded-full cursor-pointer group"
            onClick={seek}
          >
            <div
              className="h-full bg-primary rounded-full relative transition-all"
              style={{ width: `${pct}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary border-2 border-card opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono min-w-[4ch]">
            {fmt(progress)}
          </span>
        </div>
      </div>
      {!compact && (
        <button onClick={() => setMuted(!muted)} className="text-muted-foreground hover:text-foreground">
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
};

export default AudioPreview;
