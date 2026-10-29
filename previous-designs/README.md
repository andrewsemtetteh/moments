# Previous designs

Earlier versions of screens and components, kept to come back to. Nothing in the app imports
anything here, so none of it (images included) ends up in the build. They're still typechecked, so
they keep working as the app changes.

## play-cards/

| File | What it was |
|---|---|
| `PlayCardGradient.tsx` | The bold gradient Play card: white type, a line drawing on the right, a white button. Used for the Endless games, "On your own time" games, packs, rails and Today's pack before the illustrated pastel cards. |
| `AreaCardVersions.tsx` | Three earlier Handpicked area cards: `AreaCardOriginal` (gradient tile + Explore button), `AreaCardGradient` (gradient, drawing in the corner) and `AreaCardPhoto` (painted couple scene filling the card). |
| `area-photos/` | Card-sized copies (~50 KB each) of the painted scenes, for `AreaCardPhoto`. The full-size originals are in `assets/images/play/`. |

## duel/

| File | What it was |
|---|---|
| `DuelScreenV1.tsx` | The first daily duel page: an amber hero with a line of text, straight into the questions, a waiting card with the head-to-head line, and a two-row scoreboard on the results. To bring it back, copy it over `src/app/play/duel.tsx`. |

## Bringing one back

Import it where the current component is used, with the same props. For example, in
`src/components/play/AreaGrid.tsx`:

```tsx
import { AreaCardPhoto } from '../../../previous-designs/play-cards/AreaCardVersions';

<AreaCardPhoto key={area.id} area={area} meta={meta} progress={progress} />
```

Or, for the gradient Play card, wherever `PlayCard` is used:

```tsx
import { PlayCardGradient as PlayCard } from '../../../previous-designs/play-cards/PlayCardGradient';
```
