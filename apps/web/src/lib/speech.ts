import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Dictado por voz con el reconocimiento del navegador (gratis, español de México). */
export function useSpeech(onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const supported = typeof window !== 'undefined' && !!getCtor();
  const cb = useRef(onText);
  cb.current = onText;

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setError(null);
    const rec = new Ctor();
    rec.lang = 'es-MX';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let text = '';
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i]![0]!.transcript;
        final = e.results[i]!.isFinal;
      }
      cb.current(text.trim(), final);
    };
    rec.onerror = (e) => {
      setError(e.error === 'not-allowed' ? 'Permite el micrófono para dictar.' : 'No te escuché bien. Intenta otra vez.');
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  useEffect(() => () => recRef.current?.abort(), []);
  return { supported, listening, start, stop, error };
}
