import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getMetadata } from 'firebase/storage';
import { db, storage } from './config';
import PLAYERS from '../data/players';

// ── Players ──────────────────────────────────────────────────────────────────

export async function seedPlayersIfNeeded() {
  const snap = await getDocs(collection(db, 'players'));
  if (!snap.empty) return; // already seeded
  const writes = PLAYERS.map((p) =>
    setDoc(doc(db, 'players', p.id), {
      name: p.name,
      ftPct: p.ftPct,
      era: p.era,
      tags: p.tags,
      avatarUrl: p.avatarUrl || null,
    })
  );
  await Promise.all(writes);
}

export async function loadPlayers() {
  const snap = await getDocs(collection(db, 'players'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updatePlayerAvatarUrl(playerId, avatarUrl) {
  await updateDoc(doc(db, 'players', playerId), { avatarUrl });
}

// ── Avatars (Storage) ─────────────────────────────────────────────────────────

export async function getAvatarFromStorage(playerSlug) {
  try {
    const storageRef = ref(storage, `avatars/${playerSlug}.png`);
    await getMetadata(storageRef); // throws if not found
    return await getDownloadURL(storageRef);
  } catch {
    return null;
  }
}

export async function uploadAvatarToStorage(playerSlug, base64Image) {
  const byteString = atob(base64Image);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const blob = new Blob([ab], { type: 'image/png' });
  const storageRef = ref(storage, `avatars/${playerSlug}.png`);
  await uploadBytes(storageRef, blob);
  return await getDownloadURL(storageRef);
}

// ── Scores / Personal Bests ──────────────────────────────────────────────────

export async function savePersonalBest(username, playerId, score, totalShots) {
  const path = `users/${username}/scores/${playerId}`;
  const existing = await getDoc(doc(db, path));
  const pct = Math.round((score / totalShots) * 100);
  if (!existing.exists() || existing.data().score < score) {
    await setDoc(doc(db, path), {
      score,
      totalShots,
      pct,
      playerId,
      updatedAt: serverTimestamp(),
    });
    return true; // new personal best
  }
  return false;
}

export async function getPersonalBest(username, playerId) {
  const snap = await getDoc(doc(db, `users/${username}/scores/${playerId}`));
  return snap.exists() ? snap.data() : null;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function submitToLeaderboard(mode, username, playerId, score, totalShots) {
  const entry = {
    username,
    playerId,
    score,
    totalShots,
    pct: Math.round((score / totalShots) * 100),
    submittedAt: serverTimestamp(),
  };
  const entryId = `${username}_${playerId}_${Date.now()}`;
  await setDoc(doc(db, `leaderboard/${mode}/${entryId}`), entry);
}

export async function getLeaderboard(mode, limitCount = 20) {
  const q = query(
    collection(db, `leaderboard/${mode}`),
    orderBy('score', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
