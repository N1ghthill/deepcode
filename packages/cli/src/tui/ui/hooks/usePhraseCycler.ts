import { useState, useEffect, useRef } from "react";

const PHRASE_CHANGE_INTERVAL_MS = 15_000;
const PHRASE_TRANSITION_MS = 300;

const DEFAULT_PHRASES: string[] = [
  "Processando...",
  "Analisando o código...",
  "Pensando nisso...",
  "Verificando dependências...",
  "Elaborando solução...",
  "Checando o contexto...",
  "Refinando a resposta...",
  "Quase lá...",
  "Conectando os pontos...",
  "Revisando...",
];

export const usePhraseCycler = (
  isActive: boolean,
  isWaiting: boolean,
  customPhrases?: string[],
): string => {
  const phrases = customPhrases && customPhrases.length > 0 ? customPhrases : DEFAULT_PHRASES;
  const [phrase, setPhrase] = useState(phrases[0] ?? "");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (transitionRef.current !== null) { clearTimeout(transitionRef.current); transitionRef.current = null; }
    };

    if (isWaiting) {
      clearTimers();
      setPhrase("Aguardando confirmação...");
      return clearTimers;
    }

    if (isActive) {
      clearTimers();
      setPhrase(phrases[Math.floor(Math.random() * phrases.length)] ?? "");
      intervalRef.current = setInterval(() => {
        const next = phrases[Math.floor(Math.random() * phrases.length)] ?? "";
        setPhrase("...");
        transitionRef.current = setTimeout(() => {
          transitionRef.current = null;
          setPhrase(next);
        }, PHRASE_TRANSITION_MS);
      }, PHRASE_CHANGE_INTERVAL_MS);
    } else {
      clearTimers();
      setPhrase(phrases[0] ?? "");
    }

    return clearTimers;
  }, [isActive, isWaiting]); // `phrases` ref is stable within a render cycle

  return phrase;
};
