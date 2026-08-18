import { createContext, useContext, useMemo, useState } from 'react';

const SanctuaryContext = createContext(null);
const ALTAR_KEY = 'saltAndSovereigntyWorkingAltarDraft';
const GRIMOIRE_KEY = 'saltAndSovereigntyReactGrimoireDrafts';
const RITUAL_KEY = 'saltAndSovereigntyReactRituals';

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};

export function SanctuaryProvider({ children }) {
  const [altar, setAltarState] = useState(() => read(ALTAR_KEY, { name: 'Working Altar', objects: [] }));
  const [grimoire, setGrimoireState] = useState(() => read(GRIMOIRE_KEY, []));
  const [rituals, setRitualsState] = useState(() => read(RITUAL_KEY, []));

  const persist = (key, setter) => (value) => setter(current => {
    const next = typeof value === 'function' ? value(current) : value;
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  });

  const setAltar = persist(ALTAR_KEY, setAltarState);
  const setGrimoire = persist(GRIMOIRE_KEY, setGrimoireState);
  const setRituals = persist(RITUAL_KEY, setRitualsState);

  const value = useMemo(() => ({ altar, setAltar, grimoire, setGrimoire, rituals, setRituals }), [altar, grimoire, rituals]);
  return <SanctuaryContext.Provider value={value}>{children}</SanctuaryContext.Provider>;
}

export function useSanctuary() { return useContext(SanctuaryContext); }
