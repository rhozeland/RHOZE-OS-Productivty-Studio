/**
 * VoiceDictateButton — small reusable mic that streams interim+final
 * SpeechRecognition transcript out via `onTranscript(text)`. The parent
 * decides what field to append it to.
 *
 * v11 Pillar 8: lives at the *intake* layer (proposal brief, listing
 * composer) — not on already-locked surfaces like the in-project roadmap.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const getSR = (): any => {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "default";
}

export const VoiceDictateButton = ({
  onTranscript,
  disabled,
  label = "Speak",
  size = "sm",
}: Props) => {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const SR = getSR();
  const supported = !!SR;

  useEffect(() => () => { try { recRef.current?.stop?.(); } catch {} }, []);

  if (!supported) return null;

  const start = () => {
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      let finalText = "";
      rec.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript + " ";
          else interim += r[0].transcript;
        }
        onTranscript((finalText + interim).trim());
      };
      rec.onerror = () => {
        toast.error("Voice input stopped.");
        setListening(false);
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      toast.error("Couldn't start voice input.");
    }
  };

  const stop = () => {
    try { recRef.current?.stop?.(); } catch {}
    setListening(false);
  };

  return (
    <Button
      type="button"
      size={size}
      variant={listening ? "default" : "outline"}
      disabled={disabled}
      onClick={listening ? stop : start}
      className="gap-1.5 h-7 text-[11px]"
    >
      {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
      {listening ? "Stop" : label}
    </Button>
  );
};

export default VoiceDictateButton;
