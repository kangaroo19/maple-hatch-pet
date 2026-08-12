# NewChar Mushroom Character Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the NewChar character preview with the center of the large yellow mushroom and the purple platform shown in the KMS v1.2.43 reference screen.

**Architecture:** Keep the renderer and character image contract unchanged. Resolve the large mushroom placement from `scene.backgrounds` inside the existing pure `getNewCharLayout()` calculation and derive only the character rectangle's horizontal coordinate from that WZ anchor.

**Tech Stack:** TypeScript, Vitest, KMS v1.2.43 MapLogin scene manifest

## Global Constraints

- Use only KMS v1.2.43 scene data.
- Keep the character rectangle at `360 × 360` and keep its current vertical coordinate.
- Do not move the NewChar parchment, buttons, modal, or camera.
- Do not perform browser or visual verification.

---

### Task 1: Anchor the character preview to the large yellow mushroom

**Files:**
- Modify: `src/features/map-login/new-char.ts`
- Test: `src/features/map-login/new-char.test.ts`

**Interfaces:**
- Consumes: `getNewCharLayout(scene: MapLoginScene): NewCharLayout` and `Map.wz/Back/login.img/back/18` from `scene.backgrounds`
- Produces: `NEW_CHAR_MUSHROOM_SOURCE` and a `NewCharLayout.character` rectangle centered on the mushroom placement `x`

- [x] **Step 1: Write the failing layout test**

Add the mushroom source import and assert the exact anchor relationship while preserving the existing vertical placement and size:

```ts
const mushroom = scene.backgrounds.find(
  (background) => background.source === NEW_CHAR_MUSHROOM_SOURCE,
);
expect(mushroom).toBeTruthy();
expect(layout.character.x + layout.character.width / 2).toBe(mushroom?.x);
expect(layout.character).toMatchObject({
  y: -2004,
  width: 360,
  height: 360,
});
```

- [x] **Step 2: Run the test and confirm the old panel-relative position fails**

Run:

```text
npx vitest run src/features/map-login/new-char.test.ts
```

Expected: FAIL because the current character center is `-96`, while the large mushroom placement anchor is `17`.

- [x] **Step 3: Implement the WZ-anchor calculation**

Add the source contract and resolve the background with the existing panel lookup:

```ts
export const NEW_CHAR_MUSHROOM_SOURCE = "Map.wz/Back/login.img/back/18";

const mushroom = scene.backgrounds.find(
  (background) => background.source === NEW_CHAR_MUSHROOM_SOURCE,
);
if (!panelObject || !frame || !mushroom)
  throw new Error("NewChar 화면 배치를 찾을 수 없습니다.");

const characterSize = 360;
```

Return the character rectangle using the mushroom center and unchanged vertical placement:

```ts
character: {
  x: mushroom.x - characterSize / 2,
  y: panel.y + 8,
  width: characterSize,
  height: characterSize,
},
```

- [x] **Step 4: Run focused verification**

Run:

```text
npx vitest run src/features/map-login/new-char.test.ts
npm run typecheck
```

Expected: the NewChar tests and TypeScript check pass.

- [x] **Step 5: Leave the current branch uncommitted**

Do not stage or commit because the current branch already contains the user's ongoing uncommitted NewChar implementation and no commit was requested.
