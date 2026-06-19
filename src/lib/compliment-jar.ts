import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ComplimentNote {
  id: string;
  text: string;
  createdAt: string;
}

function storageKey(relationshipId: string) {
  return `compliment-jar:${relationshipId}`;
}

export async function fetchCompliments(relationshipId: string): Promise<ComplimentNote[]> {
  const raw = await AsyncStorage.getItem(storageKey(relationshipId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ComplimentNote[];
  } catch {
    return [];
  }
}

export async function addCompliment(relationshipId: string, text: string): Promise<ComplimentNote[]> {
  const existing = await fetchCompliments(relationshipId);
  const note: ComplimentNote = {
    id: `${Date.now()}`,
    text,
    createdAt: new Date().toISOString(),
  };
  const next = [note, ...existing].slice(0, 50);
  await AsyncStorage.setItem(storageKey(relationshipId), JSON.stringify(next));
  return next;
}

export async function drawCompliment(relationshipId: string): Promise<ComplimentNote | null> {
  const notes = await fetchCompliments(relationshipId);
  if (notes.length === 0) return null;
  return notes[Math.floor(Math.random() * notes.length)];
}
