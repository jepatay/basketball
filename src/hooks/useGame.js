import { useState, useCallback, useRef } from 'react';
import { calculateShotResult, calculateThreePointResult, simulateCpuShot, getDifficulty, get3PTGamePct } from '../utils/gameUtils';
import { playSwish, playClank, playPerfect, playTap, resumeAudio } from '../utils/audioUtils';
import PLAYERS from '../data/players';

/**
 * Core game engine hook.
 *
 * FT phases:  ready → h_bar → h_done → v_bar → result → (loop | done)
 * 3PT phases: ready → h_bar → h_done → v_bar → v_done → hoop_bar → result → (loop | done)
 */
export function useGame({ players, totalShots, onComplete, difficulty = 'rookie', isThreePoint = false }) {
  const { speedMult, zoneMult, cpuSpread } = getDifficulty(difficulty);

  const [phase, setPhase] = useState('ready');
  const [currentShotNum, setCurrentShotNum] = useState(1);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [hStop, setHStop] = useState(null);
  const [vStop, setVStop] = useState(null);
  const [rStop, setRStop] = useState(null);   // 3PT radial dimension
  const [lastResult, setLastResult] = useState(null);
  const [scores, setScores] = useState(players.map(() => 0));
  const [shotHistory, setShotHistory] = useState([]);
  const [suddenDeath, setSuddenDeath] = useState(false);
  const [sdRound, setSdRound] = useState(0);
  const [sdShots, setSdShots] = useState([]);

  // Refs to read in callbacks without stale-closure issues
  const hStopRef = useRef(null);
  const vStopRef = useRef(null);
  const resultTimerRef = useRef(null);

  const currentPlayer = players[currentPlayerIdx];
  // Resolve threePct: Firestore players may not have it yet — fall back to static data
  const _staticPlayer = PLAYERS.find((p) => p.id === currentPlayer?.player?.id);
  const _threePct = currentPlayer?.player?.threePct ?? _staticPlayer?.threePct ?? 33;
  // displayPct = the real career % to show in UI (FT% or 3PT%)
  const displayPct = isThreePoint
    ? _threePct
    : (currentPlayer?.player?.ftPct ?? 75);
  // ftPct = game-mechanics value (drives bar speed & zone sizing)
  const ftPct = isThreePoint ? get3PTGamePct(displayPct) : displayPct;

  // ── Stop horizontal bar ──────────────────────────────────────────────────

  const stopHBar = useCallback((position) => {
    if (phase !== 'h_bar') return;
    resumeAudio();
    playTap();
    hStopRef.current = position;
    setHStop(position);
    setPhase('h_done');
  }, [phase]);

  // ── Stop vertical bar ────────────────────────────────────────────────────

  const stopVBar = useCallback((position) => {
    if (phase !== 'v_bar') return;
    resumeAudio();
    playTap();
    vStopRef.current = position;
    setVStop(position);

    if (isThreePoint) {
      // Advance to hoop_bar in 3PT mode — result calculated later
      setPhase('v_done');
      return;
    }

    // Free throw: calculate result now (human shot → applyVariance = true)
    const result = calculateShotResult(hStopRef.current, position, ftPct, zoneMult, true);
    finishShot(result, position);
  }, [phase, ftPct, zoneMult, isThreePoint]);

  // ── Stop hoop (radial) bar — 3PT only ───────────────────────────────────

  const stopHoopBar = useCallback((position) => {
    if (phase !== 'hoop_bar') return;
    resumeAudio();
    playTap();
    setRStop(position);

    // 3PT human shot → applyVariance = true
    const result = calculateThreePointResult(hStopRef.current, vStopRef.current, position, zoneMult, ftPct, true);
    finishShot(result, null, position);
  }, [phase, zoneMult]);

  // ── Shared shot-finish logic ─────────────────────────────────────────────

  function finishShot(result) {
    setLastResult(result);
    setPhase('result');

    if (result.madeShot && result.result === 'perfect') playPerfect();
    else if (result.madeShot) playSwish();
    else playClank();

    setScores((prev) => {
      const next = [...prev];
      if (result.madeShot) next[currentPlayerIdx]++;
      return next;
    });

    setShotHistory((prev) => {
      const next = prev.map((a) => [...(a || [])]);
      while (next.length <= currentPlayerIdx) next.push([]);
      next[currentPlayerIdx] = [
        ...next[currentPlayerIdx],
        { result: result.result, madeShot: result.madeShot },
      ];
      return next;
    });

    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => advanceToNextShot(result), 1500);
  }

  // ── CPU auto-shot ────────────────────────────────────────────────────────

  const takeCpuShot = useCallback(() => {
    if (!currentPlayer.isHuman && phase === 'ready') {
      const { hStop: h, vStop: v } = simulateCpuShot(ftPct, zoneMult, cpuSpread);
      hStopRef.current = h;
      vStopRef.current = v;
      setHStop(h);
      setVStop(v);

      let result;
      if (isThreePoint) {
        // CPU also needs a radial shot; simulate it with same spread
        const rVal = Math.min(99, Math.max(1,
          28 * zoneMult * (0.5 + (Math.random() - 0.5) * 1.4 * cpuSpread)
        ));
        setRStop(rVal);
        result = calculateThreePointResult(h, v, rVal, zoneMult, ftPct);
      } else {
        result = calculateShotResult(h, v, ftPct, zoneMult);
      }

      setLastResult(result);
      setPhase('result');

      if (result.result === 'perfect') playPerfect();
      else if (result.madeShot) playSwish();
      else playClank();

      setScores((prev) => {
        const next = [...prev];
        if (result.madeShot) next[currentPlayerIdx]++;
        return next;
      });

      setShotHistory((prev) => {
        const next = prev.map((a) => [...(a || [])]);
        while (next.length <= currentPlayerIdx) next.push([]);
        next[currentPlayerIdx] = [
          ...next[currentPlayerIdx],
          { result: result.result, madeShot: result.madeShot },
        ];
        return next;
      });

      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => advanceToNextShot(result), 1000);
    }
  }, [currentPlayer, phase, ftPct, zoneMult, cpuSpread, isThreePoint, currentPlayerIdx]);

  // ── Advance to next shot ─────────────────────────────────────────────────

  function advanceToNextShot(result) {
    const isMultiplayer = players.length > 1;

    if (suddenDeath) {
      handleSuddenDeathAdvance(result);
      return;
    }

    const nextPlayerIdx  = isMultiplayer ? (currentPlayerIdx + 1) % players.length : 0;
    const isRoundComplete = !isMultiplayer || nextPlayerIdx === 0;
    const nextShotNum    = isRoundComplete ? currentShotNum + 1 : currentShotNum;

    if (nextShotNum > totalShots && isRoundComplete) {
      setScores((prevScores) => {
        if (isMultiplayer && prevScores[0] === prevScores[1]) {
          setSuddenDeath(true);
          setSdRound(1);
          setSdShots([]);
          setCurrentPlayerIdx(0);
          setHStop(null); setVStop(null); setRStop(null);
          setLastResult(null);
          setPhase('ready');
        } else {
          setPhase('done');
          onComplete?.({
            scores: prevScores,
            shotHistory,
            winner: isMultiplayer
              ? prevScores[0] > prevScores[1] ? players[0].player : players[1].player
              : null,
          });
        }
        return prevScores;
      });
    } else {
      setCurrentPlayerIdx(nextPlayerIdx);
      setCurrentShotNum(nextShotNum);
      setHStop(null); setVStop(null); setRStop(null);
      setLastResult(null);
      hStopRef.current = null; vStopRef.current = null;
      setPhase('ready');
    }
  }

  function handleSuddenDeathAdvance(result) {
    const newSdShots = [...sdShots, { playerIdx: currentPlayerIdx, madeShot: result.madeShot }];
    setSdShots(newSdShots);

    const isLastInRound = currentPlayerIdx === players.length - 1;
    if (isLastInRound && newSdShots.length >= players.length) {
      const roundShots = newSdShots.slice(-players.length);
      const p1Made = roundShots.find((s) => s.playerIdx === 0)?.madeShot;
      const p2Made = roundShots.find((s) => s.playerIdx === 1)?.madeShot;

      if (p1Made !== p2Made) {
        setScores((prevScores) => {
          const winner = p1Made ? players[0].player : players[1].player;
          setPhase('done');
          onComplete?.({ scores: prevScores, shotHistory, winner, suddenDeath: true });
          return prevScores;
        });
        return;
      }
      setSdRound((r) => r + 1);
    }

    const nextPlayerIdx = (currentPlayerIdx + 1) % players.length;
    setCurrentPlayerIdx(nextPlayerIdx);
    setHStop(null); setVStop(null); setRStop(null);
    setLastResult(null);
    setPhase('ready');
  }

  // ── Phase transitions ────────────────────────────────────────────────────

  const startShot = useCallback(() => {
    if (phase !== 'ready') return;
    resumeAudio();
    setPhase('h_bar');
  }, [phase]);

  const advanceToVBar = useCallback(() => {
    if (phase !== 'h_done') return;
    setPhase('v_bar');
  }, [phase]);

  const advanceToHoopBar = useCallback(() => {
    if (phase !== 'v_done') return;
    setPhase('hoop_bar');
  }, [phase]);

  return {
    phase, currentShotNum, currentPlayerIdx, currentPlayer,
    hStop, vStop, rStop, lastResult,
    scores, shotHistory, suddenDeath, sdRound,
    startShot, stopHBar, stopVBar, stopHoopBar,
    advanceToVBar, advanceToHoopBar,
    takeCpuShot,
    ftPct, displayPct, speedMult, zoneMult,
    isThreePoint,
  };
}
