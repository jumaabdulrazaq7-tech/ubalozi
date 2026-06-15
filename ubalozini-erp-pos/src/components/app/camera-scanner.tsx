"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ScanBarcode, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CameraScannerProps = {
  label?: string;
  onScan: (value: string) => void;
};

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

export function CameraScanner({ label = "Scan", onScan }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const scanningRef = useRef(false);
  const onScanRef = useRef(onScan);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function startScanner() {
      setError(null);
      const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
      if (!BarcodeDetectorCtor) {
        setError("Camera barcode scanning is not supported by this browser. Use manual input or a USB/Bluetooth scanner.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        detectorRef.current = new BarcodeDetectorCtor({
          formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanningRef.current = true;
          scanFrame();
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to open camera.");
      }
    }

    async function scanFrame() {
      if (!scanningRef.current || !videoRef.current || !detectorRef.current) return;
      try {
        const codes = await detectorRef.current.detect(videoRef.current);
        const value = codes[0]?.rawValue?.trim();
        if (value) {
          onScanRef.current(value);
          setOpen(false);
          return;
        }
      } catch {
        // Keep scanning; camera frames can fail transiently while autofocus settles.
      }
      window.setTimeout(scanFrame, 250);
    }

    startScanner();

    return () => {
      cancelled = true;
      scanningRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ScanBarcode data-icon="inline-start" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Camera Scanner</DialogTitle>
            <DialogDescription>Point the camera at an IMEI barcode, product barcode, or QR code.</DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <Camera />
              <AlertTitle>Scanner unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-hidden rounded-md border bg-black">
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              <X data-icon="inline-start" />
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
