"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { frameToJpeg, getFrameSource } from "@/app/lib/cameraFrame";

type CameraCaptureProps = {
  files: File[];
  onChange: (files: File[]) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  minimum?: number;
  maximum?: number;
};

const CAMERA_OPEN_TIMEOUT_MS = 15_000;
const CAMERA_PREVIEW_TIMEOUT_MS = 8_000;

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function PreviewPhoto({ file, index }: { file: File; index: number }) {
  // One URL per mounted File; adding photo eight must not decode photos one to seven again.
  const attach = useCallback((image: HTMLImageElement | null) => {
    if (!image) return;
    const url = URL.createObjectURL(file);
    image.src = url;
    return () => { image.removeAttribute("src"); URL.revokeObjectURL(url); };
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element -- this is a local camera blob, never a network image
  return <img ref={attach} alt={`Captured vehicle photo ${index + 1}`} className="absolute inset-0 h-full w-full object-cover" />;
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
  onBusyChange,
  disabled = false,
  minimum = 6,
  maximum = 8,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const openingRef = useRef(false);
  const captureLock = useRef(false);
  const playAttemptRef = useRef<Promise<void> | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const cameraActive = activeStream !== null;
  const [android] = useState(() => typeof navigator !== "undefined" && /android/i.test(navigator.userAgent));
  const singleShotSupported = android && getFrameSource() !== null;
  const [cameraOpening, setCameraOpening] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [needsPlaybackTap, setNeedsPlaybackTap] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    onBusyChange?.(cameraOpening || capturing);
    return () => onBusyChange?.(false);
  }, [cameraOpening, capturing, onBusyChange]);

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
    setActiveStream(null);
    setCameraReady(false);
    setNeedsPlaybackTap(false);
  }, [clearPreviewTimeout]);

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    openingRef.current = false;
    setCameraOpening(false);
    releaseCurrentStream();
  }, [releaseCurrentStream]);

  const startPreview = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || video.srcObject !== stream) return;

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
        if (streamRef.current !== stream || video.srcObject !== stream) return;
        clearPreviewTimeout();
        setCameraReady(video.videoWidth > 0 && video.videoHeight > 0);
        setNeedsPlaybackTap(false);
        setCameraError("");
      })
      .catch((error: unknown) => {
        if (streamRef.current !== stream || video.srcObject !== stream) return;
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
    if (!activeStream || !videoRef.current) return;

    const video = videoRef.current;
    const stream = activeStream;
    const handlePlayable = () => void startPreview();
    const handlePlaying = () => {
      if (streamRef.current !== stream) return;
      clearPreviewTimeout();
      setCameraReady(video.videoWidth > 0 && video.videoHeight > 0);
      setNeedsPlaybackTap(false);
      setCameraError("");
    };
    const handleVideoError = () => {
      if (streamRef.current !== stream) return;
      stopCamera();
      setCameraError(singleShotSupported
        ? "Live preview stopped. Aim at the vehicle and use Take photo without preview."
        : "Live preview stopped. Close other camera apps, then reopen the camera.");
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
    video.addEventListener("error", handleVideoError);
    stream.getVideoTracks().forEach((track) => track.addEventListener("ended", handleTrackEnded));
    try { video.srcObject = stream; } catch { handleVideoError(); }

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
      video.removeEventListener("error", handleVideoError);
      stream.getVideoTracks().forEach((track) => track.removeEventListener("ended", handleTrackEnded));
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [activeStream, clearPreviewTimeout, singleShotSupported, startPreview, stopCamera]);

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

  const startCamera = async (singleShot = false) => {
    if (disabled || files.length >= maximum || openingRef.current || captureLock.current) return;

    openingRef.current = true;
    releaseCurrentStream();
    setCameraError("");
    setCameraOpening(true);
    const requestId = cameraRequestRef.current + 1;
    cameraRequestRef.current = requestId;

    if (!navigator.mediaDevices?.getUserMedia) {
      openingRef.current = false;
      setCameraOpening(false);
      setCameraError("This device does not provide camera access inside the app.");
      return;
    }

    let timeoutId: number | null = null;

    try {
      const mediaRequest = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: android ? {
          facingMode: { ideal: "environment" },
          width: { ideal: 960, max: 1280 },
          height: { ideal: 720, max: 960 },
          frameRate: { ideal: 15, max: 24 },
        } : {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }).catch((error: unknown) => {
        if (!android || cameraRequestRef.current !== requestId || document.hidden ||
            !(error instanceof DOMException) || error.name !== "OverconstrainedError") throw error;
        // Some Android cameras offer only a fixed frame rate. Never retry a denied permission.
        return navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: { ideal: "environment" }, width: { ideal: 960 },
          height: { ideal: 720 }, frameRate: { ideal: 15 },
        } });
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
      if (document.hidden) throw new DOMException("App is not visible", "AbortError");
      if (singleShot) {
        const Frame = getFrameSource();
        const track = stream.getVideoTracks()[0];
        if (!Frame || !track) throw new Error("Live frame capture is unavailable");
        const grab = new Frame(track).grabFrame().then((frame) => {
          if (cameraRequestRef.current !== requestId) {
            frame.close();
            throw new DOMException("Camera closed", "AbortError");
          }
          return frame;
        });
        const frame = await Promise.race([grab, timeout]);
        try {
          // The bitmap owns its pixels; release the hardware before JPEG encoding.
          stopStream(stream);
          if (streamRef.current === stream) streamRef.current = null;
          const file = await frameToJpeg(frame, frame.width, frame.height, files.length + 1);
          if (cameraRequestRef.current === requestId && !document.hidden) onChange([...files, file]);
        } finally { frame.close(); }
        if (cameraRequestRef.current === requestId) stopCamera();
      } else {
        setActiveStream(stream);
      }
    } catch (error) {
      if (cameraRequestRef.current !== requestId) return;
      console.error("Camera opening failed:", error);
      stopCamera();
      setCameraError(cameraOpenErrorMessage(error));
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (cameraRequestRef.current === requestId) {
        openingRef.current = false;
        setCameraOpening(false);
      }
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || disabled || captureLock.current || files.length >= maximum) return;
    const requestId = cameraRequestRef.current;
    captureLock.current = true;
    setCapturing(true);

    try {
      const file = await frameToJpeg(video, video.videoWidth, video.videoHeight, files.length + 1);
      if (cameraRequestRef.current !== requestId || document.hidden) return;
      const nextFiles = [...files, file];
      onChange(nextFiles);
      if (nextFiles.length >= maximum) stopCamera();
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "The photo could not be captured");
    } finally {
      captureLock.current = false;
      setCapturing(false);
    }
  };

  const removePhoto = (index: number) => {
    if (disabled || openingRef.current || captureLock.current) return;
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
              <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-5 text-center">
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
              <span className="rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white">
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
            {singleShotSupported && files.length < maximum && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="mx-auto max-w-sm text-xs text-slate-400">If live preview closes the app, aim the rear camera at the vehicle, then tap below. Check the photo before taking the next one.</p>
                <Button type="button" variant="outline" disabled={disabled} onClick={() => void startCamera(true)} className="mt-2 min-h-11">
                  Take photo without preview
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {cameraError && <div className="rounded-xl border border-red-300/20 bg-red-300/[0.07] px-3 py-2.5 text-xs leading-5 text-red-200">{cameraError}</div>}

      <div>
        <div className="mb-2 flex items-center justify-between"><p className="text-xs font-medium text-slate-400">Captured photos</p><span className={`text-xs font-semibold ${files.length >= minimum ? "text-emerald-300" : "text-amber-300"}`}>{files.length}/{minimum} minimum · {maximum} max</span></div>
        {files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/8 py-8 text-center text-xs text-slate-600">No photos captured yet.</div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((file, index) => (
              <div key={file.name} className="relative aspect-square overflow-hidden rounded-xl border border-white/8 bg-black/20">
                <PreviewPhoto file={file} index={index} />
                <span className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/70 text-[10px] font-semibold text-white">{index + 1}</span>
                <button type="button" onClick={() => removePhoto(index)} disabled={disabled || cameraOpening || capturing} aria-label={`Remove photo ${index + 1}`} className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500 disabled:opacity-50"><X size={14} /></button>
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
