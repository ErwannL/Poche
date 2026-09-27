import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceMode = 'speech' | 'recorder' | 'none';

interface SpeechResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

interface VoiceWindow {
  SpeechRecognition?: SpeechCtor;
  webkitSpeechRecognition?: SpeechCtor;
  MediaRecorder?: typeof MediaRecorder;
}

const speechCtor = (win: VoiceWindow): SpeechCtor | undefined =>
  win.SpeechRecognition ?? win.webkitSpeechRecognition;

/** Web Speech API si disponible, sinon enregistrement audio joint, sinon rien. */
export function detectVoiceMode(win: VoiceWindow = window as VoiceWindow): VoiceMode {
  if (speechCtor(win)) return 'speech';
  if (win.MediaRecorder && typeof navigator.mediaDevices?.getUserMedia === 'function') {
    return 'recorder';
  }
  return 'none';
}

export interface VoiceOptions {
  lang: string;
  onText: (text: string) => void;
  onAudio: (blob: Blob) => void;
}

export function useVoice({ lang, onText, onAudio }: VoiceOptions) {
  const [mode] = useState(detectVoiceMode);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const callbacks = useRef({ onText, onAudio });
  callbacks.current = { onText, onAudio };

  useEffect(() => () => stopRef.current?.(), []);

  const startSpeech = useCallback(() => {
    const Ctor = speechCtor(window as VoiceWindow) as SpeechCtor;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result?.isFinal) text += result[0].transcript;
      }
      if (text.trim()) callbacks.current.onText(text.trim());
    };
    recognition.onerror = () => {
      setError(true);
    };
    recognition.onend = () => {
      stopRef.current = null;
      setActive(false);
    };
    stopRef.current = () => {
      recognition.stop();
    };
    recognition.start();
  }, [lang]);

  const startRecorder = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      stopRef.current = null;
      setActive(false);
      callbacks.current.onAudio(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    };
    stopRef.current = () => {
      recorder.stop();
    };
    recorder.start();
  }, []);

  const toggle = useCallback(async () => {
    if (stopRef.current) {
      stopRef.current();
      return;
    }
    setError(false);
    try {
      if (mode === 'speech') startSpeech();
      else await startRecorder();
      setActive(true);
    } catch {
      stopRef.current = null;
      setError(true);
    }
  }, [mode, startSpeech, startRecorder]);

  return { mode, active, error, toggle };
}
