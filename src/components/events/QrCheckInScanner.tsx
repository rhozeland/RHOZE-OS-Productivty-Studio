/**
 * QrCheckInScanner — modal that opens the device camera, decodes the
 * scanned QR (ticket.qr_token), and fires onScan once with the value.
 *
 * Uses html5-qrcode under the hood. Fully self-cleaning: stops the
 * camera and unmounts the scanner div on close.
 */
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface QrCheckInScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (token: string) => void;
}

const SCANNER_ID = "rhoze-qr-scanner";

const QrCheckInScanner = ({ open, onOpenChange, onScan }: QrCheckInScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;

    handledRef.current = false;
    setError(null);
    setStarting(true);

    let cancelled = false;

    const start = async () => {
      try {
        // Wait a tick so the dialog has mounted #SCANNER_ID
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;

        const scanner = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (handledRef.current) return;
            handledRef.current = true;
            onScan(decodedText.trim());
          },
          () => {
            // ignore per-frame decode failures
          },
        );
        if (cancelled) {
          scanner.stop().catch(() => {});
          scanner.clear();
          scannerRef.current = null;
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not access the camera. Check permissions.",
        );
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .catch(() => {})
          .finally(() => {
            try { s.clear(); } catch { /* noop */ }
          });
        scannerRef.current = null;
      }
    };
  }, [open, onScan]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Camera className="h-4 w-4 text-primary" /> Scan ticket QR
          </DialogTitle>
          <DialogDescription>
            Point the camera at the attendee's ticket. We'll check them in
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
          <div id={SCANNER_ID} className="absolute inset-0" />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center text-background/80">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-background">
              <X className="h-6 w-6" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => onOpenChange(false)}
        >
          Close scanner
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default QrCheckInScanner;
