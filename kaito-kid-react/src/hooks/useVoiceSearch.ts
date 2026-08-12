// Hook tìm kiếm bằng giọng nói dùng Web Speech API (SpeechRecognition).
// Chạy hoàn toàn ở trình duyệt (Chrome/Edge), không cần backend, miễn phí.
// Tiếng Việt: lang = 'vi-VN'. Tự ẩn nếu trình duyệt không hỗ trợ.

import { useCallback, useEffect, useRef, useState } from 'react';

// --- Khai báo type tối thiểu cho Web Speech API (chưa có sẵn trong lib.dom) ---
interface SpeechRecognitionAlternative { transcript: string; confidence: number }
interface SpeechRecognitionResult { isFinal: boolean; 0: SpeechRecognitionAlternative; length: number }
interface SpeechRecognitionResultList { length: number; [index: number]: SpeechRecognitionResult }
interface SpeechRecognitionEventLike { results: SpeechRecognitionResultList }
interface SpeechRecognitionErrorEventLike { error: string }

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseVoiceSearchOptions {
  lang?: string;
  /** Gọi khi có kết quả cuối (đã nói xong). */
  onResult?: (transcript: string) => void;
  /** Gọi liên tục với kết quả tạm (đang nói). */
  onInterim?: (transcript: string) => void;
}

export interface UseVoiceSearch {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useVoiceSearch(options: UseVoiceSearchOptions = {}): UseVoiceSearch {
  const { lang = 'vi-VN', onResult, onInterim } = options;
  const [supported] = useState<boolean>(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);

  // Giữ callback mới nhất để tránh tạo lại recognition
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);

  const stop = useCallback(() => {
    try { recogRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('Trình duyệt không hỗ trợ tìm kiếm bằng giọng nói.');
      return;
    }
    setError(null);

    // Dừng phiên cũ nếu còn
    try { recogRef.current?.abort(); } catch { /* ignore */ }

    const recog = new Ctor();
    recog.lang = lang;
    recog.continuous = false;
    recog.interimResults = true;
    recog.maxAlternatives = 1;

    recog.onstart = () => setListening(true);
    recog.onerror = (e) => {
      const code = e.error;
      const msg = code === 'not-allowed' || code === 'service-not-allowed'
        ? 'Vui lòng cho phép truy cập micro để tìm bằng giọng nói.'
        : code === 'no-speech'
          ? 'Không nghe thấy giọng nói. Bạn thử lại nhé.'
          : 'Không thể nhận diện giọng nói. Vui lòng thử lại.';
      setError(msg);
      setListening(false);
    };
    recog.onend = () => setListening(false);
    recog.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript ?? '';
        if (res.isFinal) finalText += text;
        else interimText += text;
      }
      if (interimText) onInterimRef.current?.(interimText);
      if (finalText) {
        onResultRef.current?.(finalText.trim());
        setListening(false);
      }
    };

    recogRef.current = recog;
    try {
      recog.start();
    } catch {
      // start() có thể ném nếu gọi khi đang chạy — bỏ qua
    }
  }, [lang]);

  useEffect(() => {
    return () => { try { recogRef.current?.abort(); } catch { /* ignore */ } };
  }, []);

  return { supported, listening, error, start, stop };
}
