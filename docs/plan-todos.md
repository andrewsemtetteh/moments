# To-dos on the Plan page

Status: planned, not started (written 2026-10-28).

## Goal

Let couples keep to-do lists (groceries, things to fix at home, packing) on the Plan page,
alongside their plans, without having to make a fake dated plan to hold them.

## What exists today

- **Shared lists already sync between both phones.** They're stored in the couple's `lists`
  document via `useCoupleDoc<PlanList[]>('lists', …)` in `src/app/calendar.tsx`, and edited with
  `updateLists(...)`.
- **Lists can only be reached through a plan.** A plan can be the "Shared checklist" type, or
  have checklist items, which makes a linked list (`meta.linkedListId` / `list.eventId`). The
  list opens from the plan's details sheet (`onOpenLinkedList` / `onCreateLinkedList` in
  `calendar.tsx`).
- **The list sheet** (`src/components/calendar/plan/PlanListSheet.tsx`) can add, tick, rename,
  reorder and remove items, and add or rename sections. It **can't** rename or delete the list
  itself.
- **Written but unused** in `src/lib/plan-local.ts`:
  - `createStandaloneList({ title, kind })`, which makes a list with no plan
  - `activePlanLists(lists)`, which filters out archived lists
  - `listProgress(list)`, which returns `{ done, total, pct }`
- **Probably dead code:** the `PlanTask` type and `src/components/calendar/plan/PlanTasksCard.tsx`,
  an older device-only to-do card that nothing renders. Delete it as part of this work.
- **The plan creator can already link an existing list:** `CreatePlanFlow` takes `existingLists`.

## The design

```
[ All | Together | Me | Partner ]
[ Week strip / calendar ]
Today's plans
  Dinner at Nori, 7pm
  Trip packing          4 of 9     ← a plan with a list shows its progress
To-dos
  Groceries        3 of 7  ━━━━━──
  Fix the flat     0 of 4  ───────
  + New list
Coming up
  ...
```

1. **A "To-dos" section on the Plan tab**, between the day's plans and "Coming up".
   - It shows standalone lists only (`!eventId`, not archived), newest first, each with its
     title, "3 of 7" and a thin progress bar.
   - Tapping a row opens the existing `PlanListSheet` (`setActiveListId(list.id)`).
   - It ends with a "+ New list" row.
   - With no lists, the section is just the "+ New list" row. Don't add a big empty-state card,
     so a quiet day doesn't become scrollable (see "Scrolling" below).
2. **Lists that belong to a plan stay with that plan.**
   - The plan's card in the day view (`PlanDayView` / `PlanAgendaList`) shows "4 of 9" when the
     plan has a linked list.
   - Those lists don't appear again under To-dos.
3. **Starting a list.**
   - "+ New list" calls `createStandaloneList({ title: 'To-do list' })`, adds it with
     `updateLists`, and opens the sheet straight away.
   - The cursor should already be in "Add item", so `PlanListSheet` needs an `autoFocusAdd` prop
     (or focus the field when the list has no items).
   - Optionally, add "To-do list" to the + button's type picker too.
4. **Turning a to-do into a plan.** This already works: the plan creator's `existingLists` lets
   a dated plan link an existing list. Once a plan links a list, the list gets an `eventId` and
   moves from To-dos onto that plan.

## Changes to the list sheet (`PlanListSheet.tsx`)

- **Rename the list:** tap the title in the header to edit it inline, the same way sections are
  renamed. Save on blur or submit, and ignore an empty title.
- **Delete the list:** a "Delete list" row at the bottom, with a confirmation.
  - Add an `onDelete(listId)` prop. In `calendar.tsx`, remove the list with `updateLists`, and if
    a plan links to it, clear that plan's `linkedListId` with `api.updateCalendarEvent`, as
    `onCreateLinkedList` does when it sets one.
  - Close the sheet afterwards.
- **When every item is ticked:** show "Clear done items" (removes the done items) and
  "Archive list" (sets `archived: true`, which hides it from To-dos).

## Files to touch

| File | Change |
| --- | --- |
| `src/app/calendar.tsx` | Add the To-dos section to the Plan tab; wire up "+ New list", `onDelete` and auto-focus; update `pageEmpty` (see "Scrolling") |
| `src/components/calendar/plan/PlanToDos.tsx` (new) | The section component: list rows with progress and the "+ New list" row. Match the "Coming up" card styling (`styles.section`, `sectionLabel`, `upcomingCard`) |
| `src/components/calendar/plan/PlanListSheet.tsx` | Rename the list, delete it, clear done items, archive, auto-focus "Add item" |
| `src/components/calendar/plan/PlanDayView.tsx`, `PlanAgendaList` | Show "x of y" on plans that have a linked list (pass `lists` in, or a map from `eventId` to progress) |
| `src/lib/plan-local.ts` | Use `createStandaloneList` and `activePlanLists`; add a `clearDoneItems(list)` helper; remove the `PlanTask` leftovers |
| `src/components/calendar/plan/PlanTasksCard.tsx` | Delete (unused) |

## Scrolling (keep the earlier fix working)

The Plan page only scrolls when its content is taller than the screen. While it shows an empty
state, the bottom padding that clears the + button doesn't count:
`useScrollWhenNeeded(pageEmpty ? FAB_CLEARANCE : 0)` in `calendar.tsx`.

Once To-dos is added, the page isn't "empty" if it has lists, so change this to:

```ts
const pageEmpty =
  tab === 'memories'
    ? memoriesEmpty
    : dayEvents.length === 0 && comingUp.length === 0 && standaloneLists.length === 0;
```

## Open questions (decide before building)

1. **Which days does To-dos show on?** I'd show it on every day, since lists aren't tied to a
   date. The alternative is today only, like "Coming up".
2. **Does the All / Together / Me / Partner filter apply to lists?** I'd leave it off, because
   lists are shared by both of you. Applying it would need an owner field on `PlanList`.
3. **Do lists need "who added this" or assignees?** Leave this out of the first version.
4. **Should a list be able to have a due date without becoming a plan?** Leave this out of the
   first version too. Linking the list to a plan covers it.

## How to check it works

- On a day with no plans and no lists, the Plan tab doesn't scroll, and you see "+ New list".
- "+ New list" opens the sheet with the cursor in the field. Add items, close the sheet, and the
  row shows "0 of 3".
- Tick an item on one phone and it shows on the other (same `lists` document).
- Rename the list from the sheet header and the row updates.
- Link the list to a new plan from the plan creator. The list leaves To-dos, and the plan card
  shows its progress.
- Delete a linked list and the plan no longer shows a list.
- Tick every item, archive the list, and it disappears from To-dos.
- Run `npx tsc --noEmit` and `npx vitest run`.
