"use client";

import Image from "next/image";
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
import { MapSceneCanvas } from "@/features/map-login/MapSceneCanvas";
import {
  NoticeDialog,
  type NoticeState,
} from "@/features/map-login/NoticeDialog";
import type { MapLoginScene } from "@/features/map-login/scene";
import type { Character } from "@/server/nexon-client";

type Result = {
  displayName: string;
  description: string;
  spritesheetUrl: string;
  deepLink: string;
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
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const lookupPendingRef = useRef(false);
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
  const [notice, setNotice] = useState<NoticeState>(null);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

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
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      viewport.scrollTop = destination;
      for (const event of ["wheel", "pointerdown", "touchstart"])
        viewport.removeEventListener(event, finish);
    };
    for (const event of ["wheel", "pointerdown", "touchstart"])
      viewport.addEventListener(event, finish, { once: true });
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 1000);
      const eased = 1 - (1 - progress) ** 3;
      viewport.scrollTop = start + (destination - start) * eased;
      if (progress < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
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
      setResult(null);
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
  }

  async function createPet() {
    if (!character || createPending) return;
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
    } catch (error) {
      setNotice({
        message: userMessage(error),
        returnFocus: createButtonRef.current,
      });
    } finally {
      setCreatePending(false);
    }
  }

  function reset() {
    setCharacter(null);
    setNickname("");
    setSelection({ start: 0, end: 0 });
    setStates(initialStates());
    setSelectedState("idle");
    setResult(null);
    requestAnimationFrame(() => moveCamera("bottom"));
  }

  if (desktop === false) {
    return (
      <main className="desktop-required">
        너비 1024px 이상의 데스크톱 브라우저에서 이용해 주세요.
      </main>
    );
  }
  if (desktop === null)
    return <main className="app-loading">화면을 준비하는 중…</main>;

  const deleteHref = result
    ? `mailto:1000jjj@naver.com?subject=${encodeURIComponent("Maple Hatch Pet 이미지 삭제 요청")}&body=${encodeURIComponent(`삭제할 생성 이미지 URL: ${result.spritesheetUrl}`)}`
    : "";

  return (
    <main className="map-shell">
      <header className="app-header">
        <h1>Maple Hatch Pet</h1>
        <p>메이플스토리 캐릭터를 Codex Pet으로 부화시켜 보세요.</p>
      </header>
      <div
        ref={viewportRef}
        className={`map-viewport ${character ? "is-unlocked" : "is-locked"}`}
        aria-busy={!scene}
      >
        <form
          ref={loginFormRef}
          className="native-login-form"
          onSubmit={lookup}
          noValidate
          aria-busy={lookupPending}
          aria-label="캐릭터 로그인"
        >
          <label htmlFor="nickname">닉네임</label>
          <input
            ref={nicknameRef}
            id="nickname"
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
              setSelection({
                start: event.target.selectionStart ?? event.target.value.length,
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
            aspectRatio: scene
              ? `${scene.map.width} / ${scene.map.height}`
              : undefined,
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
            onInputFocus={() => focusNativeControl(nicknameRef.current)}
            onButtonFocus={() => focusNativeControl(lookupButtonRef.current)}
            onButtonActivate={() => loginFormRef.current?.requestSubmit()}
          />
          {character && (
            <section className="creator-area" aria-label="Pet 편집">
              <div className="character-side">
                <div className="character-stage">
                  {previewUrl && (
                    <Image
                      src={previewUrl}
                      alt={`${character.name} ${STATE_LABELS[selectedState]} 미리보기`}
                      width={400}
                      height={400}
                      unoptimized
                      priority
                      className={
                        selectedState === "running-right"
                          ? "flip-character"
                          : undefined
                      }
                    />
                  )}
                </div>
                <h2>{character.name}</h2>
                <p>
                  {character.world} · {character.class} · Lv. {character.level}
                </p>
                <small>
                  공개 캐릭터 조회이며 소유권을 확인하거나 보증하지 않습니다.
                </small>
              </div>
              <div className="editor-panel">
                <p className="eyebrow">CODEX SPRITE V1</p>
                <h2>
                  {STATE_LABELS[selectedState]} ({selectedState.toUpperCase()})
                </h2>
                <div className="state-grid">
                  {PET_STATES.map((state) => (
                    <button
                      key={state}
                      type="button"
                      aria-pressed={selectedState === state}
                      onClick={() => setSelectedState(state)}
                    >
                      {STATE_LABELS[state]}
                    </button>
                  ))}
                </div>
                <div className="select-grid">
                  <label>
                    액션
                    <select
                      aria-label="액션"
                      value={selectedAction}
                      disabled={
                        selectedState === "running-left" ||
                        selectedState === "running-right"
                      }
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
                  </label>
                  <label>
                    표정
                    <select
                      aria-label="표정"
                      value={selected.emotion}
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
                  </label>
                </div>
                <div className="editor-actions">
                  <button
                    ref={createButtonRef}
                    type="button"
                    onClick={createPet}
                    disabled={createPending}
                  >
                    {createPending ? "Pet 만드는 중…" : "Pet 만들기"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={reset}
                    disabled={createPending}
                  >
                    다른 캐릭터 찾기
                  </button>
                </div>
                {result && (
                  <div className="install-area">
                    <a className="install-button" href={result.deepLink}>
                      Codex에 설치
                    </a>
                    <p>생성된 이미지는 28일 동안 설치에 사용할 수 있어요.</p>
                    <a href={deleteHref}>이미지 삭제 요청</a>
                    <small>
                      Pet 설치 딥링크가 활성화된 ChatGPT 데스크톱 앱이 필요해요.
                    </small>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
      <NoticeDialog notice={notice} onClose={() => setNotice(null)} />
    </main>
  );
}
