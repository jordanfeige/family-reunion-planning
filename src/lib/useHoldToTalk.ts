"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{
          isFinal?: boolean;
          0: { transcript: string };
        }>;
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceError =
  | "not-allowed"
  | "audio-capture"
  | "network"
  | "no-speech"
  | null;

const ERROR_COPY: Record<Exclude<VoiceError, null>, string> = {
  "not-allowed":
    "Microphone blocked. Enable it in your browser settings, or just type.",
  "audio-capture": "No microphone found. Type instead.",
  network: "Voice needs a connection right now.",
  "no-speech": "Didn't catch that.",
};

/**
 * §3 Hold-to-talk via Web Speech API.
 * Returns `supported: false` when SR is undefined — caller must hide the mic.
 */
export function useHoldToTalk(opts: {
  value: string;
  onChange: (next: string, interim?: boolean) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<VoiceError>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef(opts.value);
  const deniedRef = useRef(false);
  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(opts.onChange);
  onChangeRef.current = opts.onChange;

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
  }, []);

  useEffect(() => {
    if (!listening) baseRef.current = opts.value;
  }, [opts.value, listening]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (capTimerRef.current) clearTimeout(capTimerRef.current);
    };
  }, []);

  const stop = useCallback(() => {
    if (capTimerRef.current) {
      clearTimeout(capTimerRef.current);
      capTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (deniedRef.current) {
      setError("not-allowed");
      setErrorMessage(ERROR_COPY["not-allowed"]);
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    recognitionRef.current?.abort();
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    baseRef.current = opts.value;

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i];
        const t = row?.[0]?.transcript ?? "";
        if (row?.isFinal) finalChunk += t;
        else interim += t;
      }
      if (finalChunk) {
        const next = [baseRef.current.trim(), finalChunk.trim()]
          .filter(Boolean)
          .join(" ");
        baseRef.current = next;
        onChangeRef.current(next, false);
      } else if (interim) {
        const next = [baseRef.current.trim(), interim.trim()]
          .filter(Boolean)
          .join(" ");
        onChangeRef.current(next, true);
      }
    };

    recognition.onerror = (event) => {
      const code = event.error ?? "";
      if (code === "aborted") {
        setListening(false);
        return;
      }
      if (code === "not-allowed" || code === "service-not-allowed") {
        deniedRef.current = true;
        setError("not-allowed");
        setErrorMessage(ERROR_COPY["not-allowed"]);
      } else if (code === "no-speech") {
        setError("no-speech");
        setErrorMessage(null); // revert silently
      } else if (code === "audio-capture") {
        setError("audio-capture");
        setErrorMessage(ERROR_COPY["audio-capture"]);
      } else if (code === "network") {
        setError("network");
        setErrorMessage(ERROR_COPY.network);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setError(null);
    setErrorMessage(null);
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
    }

    capTimerRef.current = setTimeout(() => {
      stop();
    }, 45_000);
  }, [opts.value, stop]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return {
    supported,
    listening,
    error,
    errorMessage,
    start,
    stop,
    toggle,
    clearError: () => {
      setError(null);
      setErrorMessage(null);
    },
  };
}
