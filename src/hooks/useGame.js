import { useState, useCallback, useRef } from 'react';
import { calculateShotResult, simulateCpuShot, getDifficulty } from '../utils/gameUtils';
import { playSwish, playClank, playPerfect, playTap, resumeAudio } from '../utils/audioUtils';

/**
 * Core game engine hook for Free Throw Legends.
 *
 * Players: array of { player, isHuman }
 * Alternates shots between players; tracks scores.
 *
 * Phases: 'ready' | 'h_bar' | 'h_done' | 'v_bar' | 'result' | 'done'
 */
export function useGame({ players, totalShots, onComplete, difficulty = 'pro' }) {
  const { speedMult, zoneMult } = getDifficulty(difficulty);
  const [phase, setPhase] = useState('ready');
  const [currentShotNum, setCurrentShotNum] = useState(1); // 1-indexed
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [hStop, setHStop] = useState(null);
  const [vStop, setVStop] = useState(null);
  const [lastResult, setLastResult] = useState(null); // { result, hDev, vDev, madeShot }
  const [scores, setScores] = useState(players.map(() => 0));
  const [shotHistory, setShotHistory] = useState([]); // per-player shot arrays
  const [suddenDeath, setSuddenDeath] = useState(false);
  const [sdRound, setSdRound] = useState(0);
  const [sdShots, setSdShots] = useState([]); // [{ playerIdx, madeShot }]

  const resultTimerRef = useRef(null);

  const currentPlayer = players[currentPlayerIdx];
  const ftPct = currentPlayer?.player?.ftPct ?? 75;

  // ── Stop horizontal bar ───────────────────────────────────────────────────

  const stopHBar = useCallback(
    (position) => {
      if (phase !== 'h_bar') return;
      resumeAudio();
      playTap();
      setHStop(position);
      setPhase('h_done');
    },
    [phase]
  );

  // ── Stop vertical bar ─────────────────────────────────────────────────────

  const stopVBar = useCallback(
    (position) => {
      if (phase !== 'v_bar') return;
      resumeAudio();
      playTap();
      setVStop(position);

      const result = calculateShotResult(hStop, position, ftPct, zoneMult);
      setLastResult(result);
      setPhase('result');

      if (result.result === 'perfect') playPerfect();
      else if (result.madeShot) playSwish();
      else playClank();

      // Update scores
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

      // Auto-advance after 1.5s
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => {
        advanceToNextShot(result);
      }, 1500);
    },
    [phase, hStop, ftPct, zoneMult, currentPlayerIdx, currentShotNum, players, totalShots, suddenDeath, sdRound, sdShots]
  );

  // ── CPU auto-shot ─────────────────────────────────────────────────────────

  const takeCpuShot = useCallback(() => {
    if (!currentPlayer.isHuman && phase === 'ready') {
      const { hStop: h, vStop: v } = simulateCpuShot(ftPct, zoneMult);
      const result = calculateShotResult(h, v, ftPct, zoneMult);
      setHStop(h);
      setVStop(v);
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
      resultTimerRef.current = setTimeout(() => {
        advanceToNextShot(result);
      }, 1000);
    }
  }, [currentPlayer, phase, ftPct, currentPlayerIdx]);

  // ── Advance to next shot ──────────────────────────────────────────────────

  function advanceToNextShot(result) {
    const isMultiplayer = players.length > 1;

    if (suddenDeath) {
      handleSuddenDeathAdvance(result);
      return;
    }

    // Normal play: determine if we've exhausted shots for ALL players
    const nextPlayerIdx = isMultiplayer ? (currentPlayerIdx + 1) % players.length : 0;
    const isRoundComplete = !isMultiplayer || nextPlayerIdx === 0;
    const nextShotNum = isRoundComplete ? currentShotNum + 1 : currentShotNum;

    if (nextShotNum > totalShots && isRoundComplete) {
      // Check if we need sudden death
      setScores((prevScores) => {
        if (isMultiplayer && prevScores[0] === prevScores[1]) {
          // Tie → sudden death
          setSuddenDeath(true);
          setSdRound(1);
          setSdShots([]);
          setCurrentPlayerIdx(0);
          setHStop(null);
          setVStop(null);
          setLastResult(null);
          setPhase('ready');
        } else {
          setPhase('done');
          onComplete?.({
            scores: prevScores,
            shotHistory,
            winner: isMultiplayer
              ? prevScores[0] > prevScores[1]
                ? players[0].player
                : players[1].player
              : null,
          });
        }
        return prevScores;
      });
    } else {
      setCurrentPlayerIdx(nextPlayerIdx);
      setCurrentShotNum(nextShotNum);
      setHStop(null);
      setVStop(null);
      setLastResult(null);
      setPhase('ready');
    }
  }

  function handleSuddenDeathAdvance(result) {
    const newSdShots = [...sdShots, { playerIdx: currentPlayerIdx, madeShot: result.madeShot }];
    setSdShots(newSdShots);

    const isLastInRound = currentPlayerIdx === players.length - 1;

    if (isLastInRound && newSdShots.length >= players.length) {
      // Evaluate this SD round
      const roundShots = newSdShots.slice(-players.length);
      const p1Made = roundShots.find((s) => s.playerIdx === 0)?.madeShot;
      const p2Made = roundShots.find((s) => s.playerIdx === 1)?.madeShot;

      if (p1Made !== p2Made) {
        // One made, one missed → winner decided
        setScores((prevScores) => {
          const winner = p1Made ? players[0].player : players[1].player;
          setPhase('done');
          onComplete?.({ scores: prevScores, shotHistory, winner, suddenDeath: true });
          return prevScores;
        });
        return;
      }
      // Still tied → next SD round
      setSdRound((r) => r + 1);
    }

    const nextPlayerIdx = (currentPlayerIdx + 1) % players.length;
    setCurrentPlayerIdx(nextPlayerIdx);
    setHStop(null);
    setVStop(null);
    setLastResult(null);
    setPhase('ready');
  }

  // ── Start shot sequence ───────────────────────────────────────────────────

  const startShot = useCallback(() => {
    if (phase !== 'ready') return;
    resumeAudio();
    setPhase('h_bar');
  }, [phase]);

  const advanceToVBar = useCallback(() => {
    if (phase !== 'h_done') return;
    setPhase('v_bar');
  }, [phase]);

  return {
    phase,
    currentShotNum,
    currentPlayerIdx,
    currentPlayer,
    hStop,
    vStop,
    lastResult,
    scores,
    shotHistory,
    suddenDeath,
    sdRound,
    startShot,
    stopHBar,
    stopVBar,
    advanceToVBar,
    takeCpuShot,
    ftPct,
    speedMult,
    zoneMult,
  };
}
