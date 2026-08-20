"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildCharacterFrameUrl } from "@/lib/nexon-url";
import {
  ACTIONS,
  DEFAULT_STATES,
  EMOTIONS,
  PET_STATES,
  STATE_LABELS,
  type ActionCode,
  type EmotionCode,
  type PetState,
  type StateInputs,
} from "@/lib/pet-contract";
import {
  MapSceneCanvas,
  type CanvasCreatorKeyboardCommand,
} from "@/features/map-login/MapSceneCanvas";
import {
  movePetState,
  randomizeStateInputs,
  type NewCharTarget,
} from "@/features/map-login/new-char";
import {
  NoticeDialog,
  type NoticeState,
} from "@/features/map-login/NoticeDialog";
import type { MapLoginScene } from "@/features/map-login/scene";
import type { Character } from "@/server/nexon-client";

type Result = {
  displayName: string;
  description: string;
  petId: string;
  packageUrl: string;
  installCommand: string;
  expiresAt: string;
};

function initialStates(): StateInputs {
  return Object.fromEntries(
    PET_STATES.map((state) => [state, { ...DEFAULT_STATES[state] }]),
  ) as StateInputs;
}

function userMessage(value: unknown): string {
  if (value && typeof value === "object" && "error" in value) {
    const error = (value as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export function MapleHatchApp() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const loginFormRef = useRef<HTMLFormElement>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const lookupButtonRef = useRef<HTMLButtonElement>(null);
  const previousButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const actionSelectRef = useRef<HTMLSelectElement>(null);
  const emotionSelectRef = useRef<HTMLSelectElement>(null);
  const randomizeButtonRef = useRef<HTMLButtonElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const resetTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const lookupPendingRef = useRef(false);
  const createPendingRef = useRef(false);
  const initialCameraSetRef = useRef(false);
  const [desktop, setDesktop] = useState<boolean | null>(null);
  const [scene, setScene] = useState<MapLoginScene | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [nickname, setNickname] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [inputFocused, setInputFocused] = useState(false);
  const [loginButtonFocused, setLoginButtonFocused] = useState(false);
  const [loginButtonPressed, setLoginButtonPressed] = useState(false);
  const [lookupPending, setLookupPending] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [selectedState, setSelectedState] = useState<PetState>("idle");
  const [states, setStates] = useState<StateInputs>(initialStates);
  const [result, setResult] = useState<Result | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [creatorClosing, setCreatorClosing] = useState(false);
  const [creatorFocused, setCreatorFocused] = useState<NewCharTarget | null>(
    null,
  );
  const [creatorKeyboardCommand, setCreatorKeyboardCommand] =
    useState<CanvasCreatorKeyboardCommand>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [randomizeRevision, setRandomizeRevision] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null)
        window.clearTimeout(resetTimerRef.current);
      if (copyTimerRef.current !== null)
        window.clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const moveCamera = useCallback((target: "top" | "bottom") => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const destination =
      target === "top" ? 0 : viewport.scrollHeight - viewport.clientHeight;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      viewport.scrollTop = destination;
      return;
    }
    const start = viewport.scrollTop;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 1000);
      const eased = 1 - (1 - progress) ** 3;
      viewport.scrollTop = start + (destination - start) * eased;
      if (progress < 1) requestAnimationFrame(tick);
      else viewport.scrollTop = destination;
    };
    requestAnimationFrame(tick);
  }, []);

  const handleSceneReady = useCallback((loadedScene: MapLoginScene) => {
    setScene(loadedScene);
  }, []);

  useEffect(() => {
    if (!scene || initialCameraSetRef.current) return;
    initialCameraSetRef.current = true;
    const frame = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (viewport)
        viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [scene]);

  const focusNativeControl = useCallback((element: HTMLElement | null) => {
    const viewport = viewportRef.current;
    const scrollTop = viewport?.scrollTop;
    element?.focus({ preventScroll: true });
    if (viewport && scrollTop !== undefined) viewport.scrollTop = scrollTop;
  }, []);

  function clearCopyFeedback() {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    setCopyState("idle");
    setCopyStatus("");
  }

  async function copyInstallCommand() {
    if (!result) return;
    clearCopyFeedback();
    try {
      await navigator.clipboard.writeText(result.installCommand);
      setCopyState("success");
      setCopyStatus("설치 명령을 복사했습니다.");
    } catch {
      setCopyState("error");
      setCopyStatus("복사하지 못했습니다. 다시 시도해 주세요.");
    }
    copyTimerRef.current = window.setTimeout(() => {
      copyTimerRef.current = null;
      setCopyState("idle");
      setCopyStatus("");
    }, 2000);
  }

  const selected = states[selectedState];
  const selectedAction = (selected.action ?? "A03") as ActionCode;
  const action =
    ACTIONS.find((entry) => entry.code === selectedAction) ?? ACTIONS[3]!;
  useEffect(() => {
    const timer = window.setInterval(
      () => setFrameIndex((current) => (current + 1) % (action.lastFrame + 1)),
      140,
    );
    return () => window.clearInterval(timer);
  }, [action.lastFrame, selectedState, selected.emotion]);

  const previewUrl = useMemo(() => {
    if (!character) return null;
    return buildCharacterFrameUrl(
      character.imageUrl,
      `${selectedAction}.${frameIndex % (action.lastFrame + 1)}`,
      `${selected.emotion}.0`,
    ).href;
  }, [
    action.lastFrame,
    character,
    frameIndex,
    selected.emotion,
    selectedAction,
  ]);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    if (lookupPendingRef.current) return;
    const trimmed = nickname.trim();
    if (!trimmed) {
      setNotice({
        message: "닉네임을 입력해 주세요.",
        returnFocus: nicknameRef.current,
      });
      return;
    }
    lookupPendingRef.current = true;
    setLookupPending(true);
    try {
      const response = await fetch("/api/characters/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterName: trimmed }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw data;
      const found = (data as { character: Character }).character;
      setCharacter(found);
      setStates(initialStates());
      setSelectedState("idle");
      setRandomizeRevision(0);
      setResult(null);
      clearCopyFeedback();
      setCreatorClosing(false);
      setCreatorFocused(null);
      requestAnimationFrame(() => moveCamera("top"));
    } catch (error) {
      setNotice({
        message: userMessage(error),
        returnFocus:
          error &&
          typeof error === "object" &&
          "error" in error &&
          (error as { error?: { code?: string } }).error?.code ===
            "CHARACTER_NOT_FOUND"
            ? nicknameRef.current
            : lookupButtonRef.current,
        selectOnClose: true,
      });
    } finally {
      lookupPendingRef.current = false;
      setLookupPending(false);
    }
  }

  function updateSelection(field: "action" | "emotion", value: string) {
    setStates((current) => ({
      ...current,
      [selectedState]: { ...current[selectedState], [field]: value },
    }));
    setResult(null);
    clearCopyFeedback();
  }

  function randomizeAllStates() {
    setStates(randomizeStateInputs());
    setRandomizeRevision((current) => current + 1);
    setResult(null);
    clearCopyFeedback();
  }

  async function createPet() {
    if (!character || createPendingRef.current) return;
    clearCopyFeedback();
    createPendingRef.current = true;
    setCreatePending(true);
    try {
      const response = await fetch("/api/pets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          characterName: character.name,
          catalogVersion: 1,
          states,
        }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw data;
      setResult(data as Result);
      requestAnimationFrame(() => focusNativeControl(copyButtonRef.current));
    } catch (error) {
      setNotice({
        message: userMessage(error),
        returnFocus: createButtonRef.current,
      });
    } finally {
      createPendingRef.current = false;
      setCreatePending(false);
    }
  }

  function finishReset() {
    setCharacter(null);
    setNickname("");
    setSelection({ start: 0, end: 0 });
    setStates(initialStates());
    setSelectedState("idle");
    setRandomizeRevision(0);
    setResult(null);
    clearCopyFeedback();
    setCreatorClosing(false);
    setCreatorFocused(null);
    requestAnimationFrame(() => moveCamera("bottom"));
  }

  function reset() {
    if (creatorClosing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishReset();
      return;
    }
    setCreatorClosing(true);
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null;
      finishReset();
    }, 160);
  }

  function focusCreatorTarget(target: NewCharTarget) {
    const controls: Partial<Record<NewCharTarget, HTMLElement | null>> = {
      previous: previousButtonRef.current,
      next: nextButtonRef.current,
      action: actionSelectRef.current,
      emotion: emotionSelectRef.current,
      randomize: randomizeButtonRef.current,
      primary: createButtonRef.current,
      secondary: resetButtonRef.current,
      copyCommand: copyButtonRef.current,
    };
    focusNativeControl(controls[target] ?? null);
  }

  function sendCreatorKeyboardCommand(
    target: "action" | "emotion",
    key: NonNullable<CanvasCreatorKeyboardCommand>["key"],
  ) {
    setCreatorKeyboardCommand((current) => ({
      id: (current?.id ?? 0) + 1,
      target,
      key,
    }));
  }

  if (desktop === false) {
    return (
      <main className="desktop-required">
        <p>너비 1024px 이상의 데스크톱 브라우저에서 이용해 주세요.</p>
      </main>
    );
  }
  if (desktop === null)
    return (
      <main className="app-loading">
        <p>화면을 준비하는 중…</p>
      </main>
    );

  const copyButtonLabel =
    copyState === "success"
      ? "복사 완료"
      : copyState === "error"
        ? "복사 실패"
        : "명령어 복사";

  return (
    <main className="map-shell">
      <div className="map-stage">
        <div ref={viewportRef} className="map-viewport" aria-busy={!scene}>
          <form
            ref={loginFormRef}
            className="native-login-form"
            onSubmit={lookup}
            noValidate
            aria-busy={lookupPending}
            aria-label="캐릭터 로그인"
            aria-hidden={Boolean(character)}
            inert={Boolean(character)}
          >
            <label htmlFor="nickname">닉네임</label>
            <input
              ref={nicknameRef}
              id="nickname"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                setSelection({
                  start:
                    event.target.selectionStart ?? event.target.value.length,
                  end: event.target.selectionEnd ?? event.target.value.length,
                });
              }}
              onSelect={(event) =>
                setSelection({
                  start: event.currentTarget.selectionStart ?? 0,
                  end: event.currentTarget.selectionEnd ?? 0,
                })
              }
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              disabled={lookupPending}
              autoComplete="off"
              placeholder="캐릭터 닉네임"
            />
            <button
              ref={lookupButtonRef}
              type="submit"
              aria-label="로그인"
              disabled={lookupPending}
              onFocus={() => setLoginButtonFocused(true)}
              onBlur={() => {
                setLoginButtonFocused(false);
                setLoginButtonPressed(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  setLoginButtonPressed(true);
              }}
              onKeyUp={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  setLoginButtonPressed(false);
              }}
            >
              로그인
            </button>
          </form>
          <div
            className="map-scroll-space"
            style={{
              aspectRatio: scene ? `800 / ${scene.map.height}` : undefined,
            }}
          >
            <MapSceneCanvas
              viewportRef={viewportRef}
              onReady={handleSceneReady}
              loginState={{
                visible: !character,
                nickname,
                selectionStart: selection.start,
                selectionEnd: selection.end,
                inputFocused,
                buttonFocused: loginButtonFocused,
                buttonPressed: loginButtonPressed,
                disabled: lookupPending,
              }}
              creatorState={{
                visible: Boolean(character),
                closing: creatorClosing,
                character,
                previewUrl: previewUrl?.toString() ?? null,
                selectedState,
                selectedAction,
                selectedEmotion: selected.emotion as EmotionCode,
                createPending,
                hasResult: Boolean(result),
                installCommand: result?.installCommand ?? null,
                copyState,
                focused: creatorFocused,
                randomizeRevision,
              }}
              creatorKeyboardCommand={creatorKeyboardCommand}
              onInputFocus={() => focusNativeControl(nicknameRef.current)}
              onButtonFocus={() => focusNativeControl(lookupButtonRef.current)}
              onButtonActivate={() => loginFormRef.current?.requestSubmit()}
              onCreatorFocus={focusCreatorTarget}
              onStateMove={(direction) =>
                setSelectedState((current) => movePetState(current, direction))
              }
              onActionChange={(value) => updateSelection("action", value)}
              onEmotionChange={(value) => updateSelection("emotion", value)}
              onRandomize={randomizeAllStates}
              onPrimaryActivate={() => void createPet()}
              onSecondaryActivate={reset}
              onCopyCommandActivate={() => copyButtonRef.current?.click()}
            />
            {character && (
              <section className="native-creator-form" aria-label="Pet 편집">
                <p aria-live="polite">
                  {STATE_LABELS[selectedState]} ·{" "}
                  {PET_STATES.indexOf(selectedState) + 1}/{PET_STATES.length}
                </p>
                <button
                  ref={previousButtonRef}
                  type="button"
                  disabled={
                    selectedState === PET_STATES[0] ||
                    createPending ||
                    creatorClosing
                  }
                  onFocus={() => setCreatorFocused("previous")}
                  onBlur={() => setCreatorFocused(null)}
                  onClick={() =>
                    setSelectedState((current) => movePetState(current, -1))
                  }
                >
                  이전 상태
                </button>
                <button
                  ref={nextButtonRef}
                  type="button"
                  disabled={
                    selectedState === PET_STATES.at(-1) ||
                    createPending ||
                    creatorClosing
                  }
                  onFocus={() => setCreatorFocused("next")}
                  onBlur={() => setCreatorFocused(null)}
                  onClick={() =>
                    setSelectedState((current) => movePetState(current, 1))
                  }
                >
                  다음 상태
                </button>
                <label htmlFor="creator-action">액션</label>
                <select
                  ref={actionSelectRef}
                  id="creator-action"
                  value={selectedAction}
                  disabled={
                    selectedState === "running-left" ||
                    selectedState === "running-right" ||
                    createPending ||
                    creatorClosing
                  }
                  onFocus={() => setCreatorFocused("action")}
                  onBlur={() => {
                    setCreatorFocused(null);
                    sendCreatorKeyboardCommand("action", "Escape");
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key !== "ArrowUp" &&
                      event.key !== "ArrowDown" &&
                      event.key !== "Enter" &&
                      event.key !== "Escape"
                    )
                      return;
                    event.preventDefault();
                    sendCreatorKeyboardCommand("action", event.key);
                  }}
                  onChange={(event) =>
                    updateSelection("action", event.target.value)
                  }
                >
                  {ACTIONS.map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <label htmlFor="creator-emotion">표정</label>
                <select
                  ref={emotionSelectRef}
                  id="creator-emotion"
                  value={selected.emotion}
                  disabled={createPending || creatorClosing}
                  onFocus={() => setCreatorFocused("emotion")}
                  onBlur={() => {
                    setCreatorFocused(null);
                    sendCreatorKeyboardCommand("emotion", "Escape");
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key !== "ArrowUp" &&
                      event.key !== "ArrowDown" &&
                      event.key !== "Enter" &&
                      event.key !== "Escape"
                    )
                      return;
                    event.preventDefault();
                    sendCreatorKeyboardCommand("emotion", event.key);
                  }}
                  onChange={(event) =>
                    updateSelection(
                      "emotion",
                      event.target.value as EmotionCode,
                    )
                  }
                >
                  {EMOTIONS.map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <button
                  ref={randomizeButtonRef}
                  type="button"
                  disabled={createPending || creatorClosing}
                  onFocus={() => setCreatorFocused("randomize")}
                  onBlur={() => setCreatorFocused(null)}
                  onClick={randomizeAllStates}
                >
                  모든 상태 랜덤 설정
                </button>
                <button
                  ref={createButtonRef}
                  type="button"
                  disabled={createPending || creatorClosing}
                  onFocus={() => setCreatorFocused("primary")}
                  onBlur={() => setCreatorFocused(null)}
                  onClick={() => void createPet()}
                >
                  Pet 만들기
                </button>
                <button
                  ref={resetButtonRef}
                  type="button"
                  disabled={createPending || creatorClosing}
                  onFocus={() => setCreatorFocused("secondary")}
                  onBlur={() => setCreatorFocused(null)}
                  onClick={reset}
                >
                  다른 캐릭터 찾기
                </button>
                <code aria-label="설치 명령">
                  {result?.installCommand ??
                    "Pet을 만들면 설치 명령이 표시됩니다."}
                </code>
                <button
                  ref={copyButtonRef}
                  type="button"
                  disabled={!result || createPending || creatorClosing}
                  onFocus={() => setCreatorFocused("copyCommand")}
                  onBlur={() => setCreatorFocused(null)}
                  onClick={() => void copyInstallCommand()}
                >
                  {copyButtonLabel}
                </button>
                <p aria-live="polite">{copyStatus}</p>
              </section>
            )}
          </div>
        </div>
      </div>
      <NoticeDialog notice={notice} onClose={() => setNotice(null)} />
    </main>
  );
}
