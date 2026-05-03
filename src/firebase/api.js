import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import PLAYERS from '../data/players';

// ── Players ──────────────────────────────────────────────────────────────────

export async function seedPlayersIfNeeded() {
  const snap = await getDocs(collection(db, 'players'));
  if (!snap.empty) return;
  const writes = PLAYERS.map((p) =>
    setDoc(doc(db, 'players', p.id), {
      name: p.name,
      ftPct: p.ftPct,
      era: p.era,
      tags: p.tags,
      avatarBase64: null,  // stored here instead of Firebase Storage
    })
  );
  await Promise.all(writes);
}

export async function loadPlayers() {
  const snap = await getDocs(collection(db, 'players'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Save base64 avatar string directly in the Firestore player document */
export async function savePlayerAvatar(playerId, base64Image) {
  await updateDoc(doc(db, 'players', playerId), { avatarBase64: base64Image });
}

/** Add a brand-new player document (from Admin panel) */
export async function addPlayer(playerId, playerData, base64Image) {
  await setDoc(doc(db, 'players', playerId), {
    ...playerData,
    avatarBase64: base64Image || null,
  });
}

// ── Scores / Personal Bests ──────────────────────────────────────────────────

export async function savePersonalBest(username, playerId, score, totalShots, extras = {}, difficulty = 'pro') {
  const docId = `${playerId}_${difficulty}`;
  const path = `users/${username}/scores/${docId}`;
  const existing = await getDoc(doc(db, path));
  const pct = Math.round((score / totalShots) * 100);
  if (!existing.exists() || existing.data().score < score) {
    await setDoc(doc(db, path), {
      score, totalShots, pct, playerId, difficulty,
      ...extras,
      updatedAt: serverTimestamp(),
    });
    return true;
  }
  return false;
}

export async function getPersonalBest(username, playerId, difficulty = 'pro') {
  const snap = await getDoc(doc(db, `users/${username}/scores/${playerId}_${difficulty}`));
  return snap.exists() ? snap.data() : null;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
// Single top-level 'leaderboard' collection. Each document has a 'modeKey'
// field (e.g. 'century_pro') used as a filter. 2-segment paths are always valid.
// Firestore rules must allow read/write on the 'leaderboard' collection.

export async function submitToLeaderboard(mode, username, playerId, score, totalShots, extras = {}, difficulty = 'pro') {
  const modeKey = `${mode}_${difficulty}`;
  const entryId = `${modeKey}_${username}_${Date.now()}`;
  await setDoc(doc(db, 'leaderboard', entryId), {
    modeKey, username, playerId, score, totalShots, difficulty,
    pct: Math.round((score / totalShots) * 100),
    ...extras,
    submittedAt: serverTimestamp(),
  });
}

export async function getLeaderboard(mode, limitCount = 20, difficulty = 'pro') {
  const modeKey = `${mode}_${difficulty}`;
  // Single-field where() needs no composite index; sort client-side.
  const q = query(
    collection(db, 'leaderboard'),
    where('modeKey', '==', modeKey),
    limit(500)
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return docs.sort((a, b) => b.score - a.score).slice(0, limitCount);
}

// ── Tournaments ───────────────────────────────────────────────────────────────

export async function saveTournamentResult(username, tournamentData) {
  const id = `tournament_${Date.now()}`;
  await setDoc(doc(db, `users/${username}/tournaments/${id}`), {
    ...tournamentData,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function getTournamentHistory(username) {
  const snap = await getDocs(collection(db, `users/${username}/tournaments`));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}
