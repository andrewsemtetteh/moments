import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlanChecklistItem, PlanKindKey } from '@/lib/plan-meta';

export type PlanTask = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

export type PlanListItem = {
  id: string;
  title: string;
  done: boolean;
};

export type PlanListSection = {
  id: string;
  title: string;
  items: PlanListItem[];
};

/** Dynamic shared list — created from a plan or manually, never a fixed catalog. */
export type PlanList = {
  id: string;
  title: string;
  emoji: string;
  /** Calendar event this list was created for, if any */
  eventId?: string | null;
  kind?: PlanKindKey;
  createdAt: string;
  archived?: boolean;
  sections: PlanListSection[];
};

function tasksKey(relationshipId: string) {
  return `plan-tasks:${relationshipId}`;
}

function listsKey(relationshipId: string) {
  return `plan-lists-v3:${relationshipId}`;
}

function dayNotesKey(relationshipId: string, dateKey: string) {
  return `plan-day-notes:${relationshipId}:${dateKey}`;
}

export async function fetchPlanTasks(relationshipId: string): Promise<PlanTask[]> {
  const raw = await AsyncStorage.getItem(tasksKey(relationshipId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PlanTask[];
  } catch {
    return [];
  }
}

export async function savePlanTasks(relationshipId: string, tasks: PlanTask[]) {
  await AsyncStorage.setItem(tasksKey(relationshipId), JSON.stringify(tasks));
}

function normalizeList(raw: PlanList): PlanList {
  if (raw.sections?.length) {
    return {
      ...raw,
      createdAt: raw.createdAt ?? new Date().toISOString(),
    };
  }
  const legacy = raw as PlanList & { items?: PlanListItem[] };
  return {
    ...raw,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    sections: [{ id: 'main', title: 'Items', items: legacy.items ?? [] }],
  };
}

export async function fetchPlanLists(relationshipId: string): Promise<PlanList[]> {
  const raw = await AsyncStorage.getItem(listsKey(relationshipId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PlanList[];
    return parsed
      .map(normalizeList)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function savePlanLists(relationshipId: string, lists: PlanList[]) {
  await AsyncStorage.setItem(listsKey(relationshipId), JSON.stringify(lists));
}

export function activePlanLists(lists: PlanList[]): PlanList[] {
  return lists.filter((l) => !l.archived);
}

export function listProgress(list: PlanList): { done: number; total: number; pct: number } {
  const items = list.sections.flatMap((s) => s.items);
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function listEmojiForKind(kind?: PlanKindKey): string {
  switch (kind) {
    case 'trip':
      return '🧳';
    case 'date':
      return '❤️';
    case 'celebration':
      return '🎉';
    case 'activity':
      return '🎬';
    case 'outing':
      return '☕';
    case 'checklist':
      return '✅';
    case 'goal':
      return '🎯';
    case 'reminder':
      return '🔔';
    case 'note':
      return '📝';
    default:
      return '📋';
  }
}

export function createListFromPlan(input: {
  planTitle: string;
  kind: PlanKindKey;
  eventId: string;
  checklist?: PlanChecklistItem[];
}): PlanList {
  const id = `list-${input.eventId}`;
  const checklistItems: PlanListItem[] = (input.checklist ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    done: c.done,
  }));

  if (input.kind === 'trip') {
    return {
      id,
      title: `${input.planTitle} packing`,
      emoji: listEmojiForKind('trip'),
      eventId: input.eventId,
      kind: input.kind,
      createdAt: new Date().toISOString(),
      sections: [
        { id: 'essentials', title: 'Essentials', items: checklistItems },
        { id: 'clothes', title: 'Clothes', items: [] },
      ],
    };
  }

  return {
    id,
    title: `${input.planTitle} list`,
    emoji: listEmojiForKind(input.kind),
    eventId: input.eventId,
    kind: input.kind,
    createdAt: new Date().toISOString(),
    sections: [{ id: 'main', title: 'Items', items: checklistItems }],
  };
}

export function createStandaloneList(input: {
  title: string;
  kind?: PlanKindKey;
}): PlanList {
  const kind = input.kind ?? 'checklist';
  return {
    id: `list-${Date.now()}`,
    title: input.title.trim() || 'New list',
    emoji: listEmojiForKind(kind),
    eventId: null,
    kind,
    createdAt: new Date().toISOString(),
    sections: [{ id: 'main', title: 'Items', items: [] }],
  };
}

export function duplicateList(list: PlanList): PlanList {
  const stamp = Date.now();
  return {
    ...list,
    id: `list-${stamp}`,
    title: `${list.title} copy`,
    eventId: null,
    archived: false,
    createdAt: new Date().toISOString(),
    sections: list.sections.map((s, si) => ({
      ...s,
      id: `section-${stamp}-${si}`,
      items: s.items.map((item, ii) => ({
        ...item,
        id: `item-${stamp}-${si}-${ii}`,
        done: false,
      })),
    })),
  };
}

/** Merge event checklist into the first section of a linked list (keeps extra list-only items). */
export function syncChecklistIntoList(list: PlanList, checklist: PlanChecklistItem[]): PlanList {
  if (!list.sections.length) {
    return {
      ...list,
      sections: [
        {
          id: 'main',
          title: 'Items',
          items: checklist.map((c) => ({ id: c.id, title: c.title, done: c.done })),
        },
      ],
    };
  }

  const [first, ...rest] = list.sections;
  const byId = new Map(first.items.map((i) => [i.id, i]));
  const merged: PlanListItem[] = checklist.map((c) => ({
    id: c.id,
    title: c.title,
    done: c.done,
  }));
  for (const item of first.items) {
    if (!checklist.some((c) => c.id === item.id)) merged.push(item);
  }
  // Prefer checklist order; keep orphaned list items after
  void byId;
  return { ...list, sections: [{ ...first, items: merged }, ...rest] };
}

export function shouldCreateListForPlan(kind: PlanKindKey, checklistCount: number): boolean {
  if (checklistCount > 0) return true;
  return kind === 'trip' || kind === 'celebration' || kind === 'checklist';
}

export async function fetchDayNotes(relationshipId: string, dateKey: string): Promise<string> {
  return (await AsyncStorage.getItem(dayNotesKey(relationshipId, dateKey))) ?? '';
}

export async function saveDayNotes(relationshipId: string, dateKey: string, notes: string) {
  await AsyncStorage.setItem(dayNotesKey(relationshipId, dateKey), notes);
}
