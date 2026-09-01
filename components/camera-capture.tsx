"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Check,
  LoaderCircle,
  Play,
  RefreshCcw,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type CameraCaptureProps = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  minimum?: number;
  maximum?: number;
};

const CAMERA_OPEN_TIMEOUT_MS = 15_000;
const CAMERA_PREVIEW_TIMEOUT_MS = 8_000;

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function cameraOpenErrorMessage(error: unknown) {
  const errorName = error instanceof DOMException ? error.name : "";

  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return "Camera access is blocked. Allow camera permission for this app in your phone settings, then try again.";
  }
  if (errorName === "NotFoundError" || errorName === "OverconstrainedError") {
    return "A usable camera could not be found on this device.";
  }
  if (errorName === "NotReadableError" || errorName === "AbortError") {
    return "The camera is busy. Close any other app using it, wait a moment, then try again.";
  }
  if (errorName === "TimeoutError") {
    return "The camera took too long to open. Close any other app using it, then try again.";
  }

  return "The camera could not open. Check camera permission and try again.";
}

export function CameraCapture({
  files,
  onChange,
  disabled = false,
  minimum = 6,
  maximum = 8,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const playAttemptRef = useRef<Promise<void> | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraOpening, setCameraOpening] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [needsPlaybackTap, setNeedsPlaybackTap] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturing, setCapturing] = useState(false);

  const clearPreviewTimeout = useCallback(() => {
    if (previewTimeoutRef.current !== null) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  }, []);

  const releaseCurrentStream = useCallback(() => {
    clearPreviewTimeout();
    playAttemptRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    stopStream(stream);
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraReady(false);
    setNeedsPlaybackTap(false);
  }, [clearPreviewTimeout]);

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    setCameraOpening(false);
    releaseCurrentStream();
  }, [releaseCurrentStream]);

  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );

  useEffect(
    () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
    [previews]
  );

  const startPreview = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.srcObject) return;

    if (!video.paused && video.videoWidth > 0 && video.videoHeight > 0) {
      clearPreviewTimeout();
      setCameraReady(true);
      setNeedsPlaybackTap(false);
      setCameraError("");
      return;
    }

    if (playAttemptRef.current) {
      await playAttemptRef.current;
      return;
    }

    const playAttempt = video
      .play()
      .then(() => {
        clearPreviewTimeout();
        setCameraReady(video.videoWidth > 0 && video.videoHeight > 0);
        setNeedsPlaybackTap(false);
        setCameraError("");
      })
      .catch((error: unknown) => {
        const errorName = error instanceof DOMException ? error.name : "";
        if (errorName === "AbortError") return;

        console.error("Camera preview could not start:", error);
        setNeedsPlaybackTap(true);
        if (errorName !== "NotAllowedError") {
          setCameraError("The camera is open, but its preview is paused. Tap Start preview or restart the camera.");
        }
      });

    playAttemptRef.current = playAttempt;
    try {
      await playAttempt;
    } finally {
      if (playAttemptRef.current === playAttempt) {
        playAttemptRef.current = null;
      }
    }
  }, [clearPreviewTimeout]);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const stream = streamRef.current;
    const handlePlayable = () => void startPreview();
    const handlePlaying = () => {
      clearPreviewTimeout();
      setCameraReady(video.videoWidth > 0 && video.videoHeight > 0);
      setNeedsPlaybackTap(false);
      setCameraError("");
    };
    const handleTrackEnded = () => {
      if (streamRef.current !== stream) return;
      setCameraReady(false);
      setCameraError("The camera stopped. Tap restart to open it again.");
    };

    video.muted = true;
    video.playsInline = true;
    video.addEventListener("loadedmetadata", handlePlayable);
    video.addEventListener("canplay", handlePlayable);
    video.addEventListener("playing", handlePlaying);
    stream.getVideoTracks().forEach((track) => track.addEventListener("ended", handleTrackEnded));
    video.srcObject = stream;

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      void startPreview();
    }

    previewTimeoutRef.current = window.setTimeout(() => {
      if (video.paused || !video.videoWidth || !video.videoHeight) {
        setNeedsPlaybackTap(true);
      }
    }, CAMERA_PREVIEW_TIMEOUT_MS);

    return () => {
      clearPreviewTimeout();
      playAttemptRef.current = null;
      video.removeEventListener("loadedmetadata", handlePlayable);
      video.removeEventListener("canplay", handlePlayable);
      video.removeEventListener("playing", handlePlaying);
      stream.getVideoTracks().forEach((track) => track.removeEventListener("ended", handleTrackEnded));
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [cameraActive, clearPreviewTimeout, startPreview]);

  useEffect(() => {
    const releaseWhenHidden = () => {
      if (document.visibilityState === "hidden" && streamRef.current) stopCamera();
    };

    document.addEventListener("visibilitychange", releaseWhenHidden);
    window.addEventListener("pagehide", stopCamera);
    return () => {
      document.removeEventListener("visibilitychange", releaseWhenHidden);
      window.removeEventListener("pagehide", stopCamera);
    };
  }, [stopCamera]);

  useEffect(() => () => {
    cameraRequestRef.current += 1;
    clearPreviewTimeout();
    stopStream(streamRef.current);
    streamRef.current = null;
  }, [clearPreviewTimeout]);

  const startCamera = async () => {
    if (disabled || files.length >= maximum || cameraOpening) return;

    releaseCurrentStream();
    setCameraError("");
    setCameraOpening(true);
    const requestId = cameraRequestRef.current + 1;
    cameraRequestRef.current = requestId;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraOpening(false);
      setCameraError("This device does not provide camera access inside the app.");
      return;
    }

    let timeoutId: number | null = null;

    try {
      const mediaRequest = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }).then((stream) => {
        if (cameraRequestRef.current !== requestId) {
          stopStream(stream);
          throw new DOMException("The camera request was replaced", "AbortError");
        }
        return stream;
      });

      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new DOMException("The camera took too long to open", "TimeoutError"));
        }, CAMERA_OPEN_TIMEOUT_MS);
      });

      const stream = await Promise.race([mediaRequest, timeout]);
      if (cameraRequestRef.current !== requestId) {
        stopStream(stream);
        return;
      }

      streamRef.current = stream;
      setCameraOpening(false);
      setCameraActive(true);
    } catch (error) {
      if (cameraRequestRef.current !== requestId) return;
      cameraRequestRef.current += 1;
      console.error("Camera opening failed:", error);
      setCameraOpening(false);
      releaseCurrentStream();
      setCameraError(cameraOpenErrorMessage(error));
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || files.length >= maximum) return;
    setCapturing(true);

    try {
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      if (!sourceWidth || !sourceHeight) throw new Error("The camera is not ready");

      const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("The photo could not be captured");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.78)
      );
      if (!blob) throw new Error("The photo could not be captured");

      const file = new File([blob], `vehicle-${Date.now()}-${files.length + 1}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      const nextFiles = [...files, file];
      onChange(nextFiles);
      if (nextFiles.length >= maximum) stopCamera();
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "The photo could not be captured");
    } finally {
      setCapturing(false);
    }
  };

  const removePhoto = (index: number) => {
    if (disabled) return;
    onChange(files.filter((_, photoIndex) => photoIndex !== index));
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
        {cameraActive ? (
          <div className="relative aspect-[3/4] max-h-[58vh] w-full bg-black sm:aspect-video">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-5 text-center backdrop-blur-[2px]">
                {needsPlaybackTap ? (
                  <div>
                    <p className="text-sm font-medium text-white">Camera is open. Start the preview.</p>
                    <Button type="button" onClick={() => void startPreview()} className="mt-3 h-10 rounded-xl bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200">
                      <Play size={16} /> Start preview
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <LoaderCircle size={18} className="animate-spin text-cyan-300" /> Starting preview...
                  </div>
                )}
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/65 to-transparent p-3">
              <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                Camera only · {files.length}/{maximum}
              </span>
              {files.length >= minimum && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-400/85 px-2.5 py-1 text-[10px] font-semibold text-emerald-950">
                  <Check size={11} /> Minimum reached
                </span>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/75 to-transparent p-4 pt-12">
              <Button type="button" variant="ghost" size="icon" onClick={() => stopCamera()} disabled={disabled} aria-label="Close camera" className="size-11 rounded-full bg-black/55 text-white hover:bg-black/75">
                <CameraOff size={19} />
              </Button>
              <button type="button" onClick={() => void capture()} disabled={!cameraReady || capturing || disabled || files.length >= maximum} aria-label="Take photo" className="flex size-18 items-center justify-center rounded-full border-4 border-white bg-white/20 shadow-xl transition active:scale-95 disabled:opacity-50">
                <span className="size-14 rounded-full bg-white" />
              </button>
              <Button type="button" variant="ghost" size="icon" onClick={() => void startCamera()} disabled={disabled || cameraOpening} aria-label="Restart camera" className="size-11 rounded-full bg-black/55 text-white hover:bg-black/75">
                <RefreshCcw size={18} />
              </Button>
            </div>
          </div>
        ) : cameraOpening ? (
          <div className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
            <LoaderCircle size={30} className="animate-spin text-cyan-300" />
            <p className="mt-4 text-sm font-semibold text-white">Opening camera...</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Allow camera access if your phone asks for permission.</p>
            <Button type="button" variant="outline" onClick={() => stopCamera()} className="mt-4 h-10 rounded-xl border-white/10 bg-white/[0.03] text-slate-300">
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300"><Camera size={26} /></span>
            <p className="mt-4 text-sm font-semibold text-white">Take {minimum} required vehicle photos</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Photos must be taken now. The gallery and file picker are not available in this report.</p>
            <Button type="button" onClick={() => void startCamera()} disabled={disabled || files.length >= maximum} className="mt-4 h-11 rounded-xl bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200"><Camera size={17} /> {files.length ? "Continue taking photos" : "Open camera"}</Button>
          </div>
        )}
      </div>

      {cameraError && <div className="rounded-xl border border-red-300/20 bg-red-300/[0.07] px-3 py-2.5 text-xs leading-5 text-red-200">{cameraError}</div>}

      <div>
        <div className="mb-2 flex items-center justify-between"><p className="text-xs font-medium text-slate-400">Captured photos</p><span className={`text-xs font-semibold ${files.length >= minimum ? "text-emerald-300" : "text-amber-300"}`}>{files.length}/{minimum} minimum · {maximum} max</span></div>
        {previews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/8 py-8 text-center text-xs text-slate-600">No photos captured yet.</div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {previews.map((preview, index) => (
              <div key={`${files[index]?.name}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-white/8 bg-black/20">
                <Image src={preview} alt={`Captured vehicle photo ${index + 1}`} fill sizes="(max-width: 640px) 33vw, 160px" unoptimized className="object-cover" />
                <span className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/70 text-[10px] font-semibold text-white">{index + 1}</span>
                <button type="button" onClick={() => removePhoto(index)} disabled={disabled} aria-label={`Remove photo ${index + 1}`} className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500 disabled:opacity-50"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {files.length > 0 && files.length < maximum && !cameraActive && !cameraOpening && (
        <Button type="button" variant="outline" onClick={() => void startCamera()} disabled={disabled} className="h-10 w-full rounded-xl border-white/10 bg-white/[0.03] text-slate-300"><RotateCcw size={15} /> Take another photo</Button>
      )}
    </div>
  );
}
