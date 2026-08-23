import { invalidRequest } from "@/lib/errors";

export type ActionCode = `A${string}`;
export type EmotionCode = `E${string}`;

export type CatalogEntry<TCode extends string> = {
  code: TCode;
  officialName: string;
  label: string;
  lastFrame: number;
};

export const ACTIONS = [
  ["A00", "stand1", "기본 자세 1", 2],
  ["A01", "stand2", "기본 자세 2", 2],
  ["A02", "walk1", "걷기 1", 3],
  ["A03", "walk2", "걷기 2", 3],
  ["A04", "prone", "엎드리기", 0],
  ["A05", "fly", "비행", 1],
  ["A06", "jump", "점프", 0],
  ["A07", "sit", "앉기", 0],
  ["A08", "ladder", "사다리", 1],
  ["A09", "rope", "밧줄", 1],
  ["A10", "heal", "회복", 2],
  ["A11", "alert", "경계", 2],
  ["A12", "proneStab", "엎드려 찌르기", 1],
  ["A13", "swingO1", "휘두르기 1-1", 2],
  ["A14", "swingO2", "휘두르기 1-2", 2],
  ["A15", "swingO3", "휘두르기 1-3", 2],
  ["A16", "swingOF", "휘두르기 1-4", 3],
  ["A17", "swingP1", "휘두르기 2-1", 2],
  ["A18", "swingP2", "휘두르기 2-2", 2],
  ["A19", "swingPF", "휘두르기 2-3", 3],
  ["A20", "swingT1", "휘두르기 3-1", 2],
  ["A21", "swingT2", "휘두르기 3-2", 2],
  ["A22", "swingT3", "휘두르기 3-3", 2],
  ["A23", "swingTF", "휘두르기 3-4", 3],
  ["A24", "stabO1", "찌르기 1-1", 1],
  ["A25", "stabO2", "찌르기 1-2", 1],
  ["A26", "stabOF", "찌르기 1-3", 2],
  ["A27", "stabT1", "찌르기 2-1", 2],
  ["A28", "stabT2", "찌르기 2-2", 2],
  ["A29", "stabTF", "찌르기 2-3", 3],
  ["A30", "shoot1", "사격 1", 2],
  ["A31", "shoot2", "사격 2", 4],
  ["A32", "shootF", "사격 3", 2],
  ["A33", "dead", "쓰러짐", 0],
  ["A34", "ghostwalk", "유령 걷기", 3],
  ["A35", "ghoststand", "유령 기본 자세", 2],
  ["A36", "ghostjump", "유령 점프", 0],
  ["A37", "ghostproneStab", "유령 엎드려 찌르기", 1],
  ["A38", "ghostladder", "유령 사다리", 1],
  ["A39", "ghostrope", "유령 밧줄", 1],
  ["A40", "ghostfly", "유령 비행", 1],
  ["A41", "ghostsit", "유령 앉기", 0],
].map(([code, officialName, label, lastFrame]) => ({
  code,
  officialName,
  label,
  lastFrame,
})) as readonly CatalogEntry<ActionCode>[];

export const RUNNING_ACTIONS = ACTIONS.filter(
  (entry) => entry.code === "A02" || entry.code === "A03",
);

export const EMOTIONS = [
  ["E00", "default", "기본", 0],
  ["E01", "wink", "윙크", 0],
  ["E02", "smile", "웃음", 0],
  ["E03", "cry", "울음", 0],
  ["E04", "angry", "화남", 0],
  ["E05", "bewildered", "당황", 0],
  ["E06", "blink", "눈 깜빡임", 2],
  ["E07", "blaze", "불꽃", 1],
  ["E08", "bowing", "절하기", 1],
  ["E09", "cheers", "환호", 0],
  ["E10", "chu", "뽀뽀", 0],
  ["E11", "dam", "분함", 1],
  ["E12", "despair", "절망", 1],
  ["E13", "glitter", "반짝임", 1],
  ["E14", "hit", "맞음", 0],
  ["E15", "hot", "더움", 1],
  ["E16", "hum", "콧노래", 1],
  ["E17", "love", "사랑", 1],
  ["E18", "oops", "앗", 0],
  ["E19", "pain", "고통", 0],
  ["E20", "troubled", "곤란", 0],
  ["E21", "qBlue", "우울", 0],
  ["E22", "shine", "빛남", 0],
  ["E23", "stunned", "기절", 0],
  ["E24", "vomit", "구토", 1],
].map(([code, officialName, label, lastFrame]) => ({
  code,
  officialName,
  label,
  lastFrame,
})) as readonly CatalogEntry<EmotionCode>[];

export const PET_STATES = [
  "idle",
  "running-right",
  "running-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review",
] as const;
export type PetState = (typeof PET_STATES)[number];
export type StateInput = { action?: string; emotion: string };
export type StateInputs = Record<PetState, StateInput>;
export type NormalizedState = {
  action: ActionCode;
  emotion: `${EmotionCode}.0`;
};
export type NormalizedStates = Record<PetState, NormalizedState>;

export const STATE_LABELS: Record<PetState, string> = {
  idle: "기본",
  "running-right": "오른쪽 달리기",
  "running-left": "왼쪽 달리기",
  waving: "손 흔들기",
  jumping: "점프",
  failed: "실패",
  waiting: "대기",
  running: "실행 중",
  review: "검토",
};

export const DEFAULT_STATES: StateInputs = {
  idle: { action: "A01", emotion: "E00" },
  "running-right": { action: "A03", emotion: "E00" },
  "running-left": { action: "A03", emotion: "E00" },
  waving: { action: "A00", emotion: "E02" },
  jumping: { action: "A06", emotion: "E00" },
  failed: { action: "A04", emotion: "E03" },
  waiting: { action: "A07", emotion: "E05" },
  running: { action: "A00", emotion: "E00" },
  review: { action: "A00", emotion: "E05" },
};

const actionByCode = new Map(ACTIONS.map((entry) => [entry.code, entry]));
const emotionCodes = new Set(EMOTIONS.map((entry) => entry.code));
const runningActionCodes = new Set<ActionCode>(["A02", "A03"]);
const runningStates = new Set<PetState>(["running-right", "running-left"]);

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalidRequest();
  return value as Record<string, unknown>;
}

export function normalizePetRequest(input: unknown): {
  characterName: string;
  catalogVersion: 1;
  states: NormalizedStates;
} {
  const body = objectValue(input);
  const characterName =
    typeof body.characterName === "string" ? body.characterName.trim() : "";
  if (!characterName || body.catalogVersion !== 1) throw invalidRequest();
  const rawStates = objectValue(body.states);
  if (Object.keys(rawStates).length !== PET_STATES.length)
    throw invalidRequest();

  const states = {} as NormalizedStates;
  for (const state of PET_STATES) {
    const selection = objectValue(rawStates[state]);
    if (
      typeof selection.emotion !== "string" ||
      !emotionCodes.has(selection.emotion as EmotionCode)
    ) {
      throw invalidRequest();
    }
    if (runningStates.has(state)) {
      const hasAction = "action" in selection;
      if (
        hasAction &&
        (typeof selection.action !== "string" ||
          !runningActionCodes.has(selection.action as ActionCode))
      ) {
        throw invalidRequest();
      }
      states[state] = {
        action: (hasAction ? selection.action : "A03") as ActionCode,
        emotion: `${selection.emotion}.0` as `${EmotionCode}.0`,
      };
      continue;
    }
    if (
      typeof selection.action !== "string" ||
      !actionByCode.has(selection.action as ActionCode)
    ) {
      throw invalidRequest();
    }
    states[state] = {
      action: selection.action as ActionCode,
      emotion: `${selection.emotion}.0` as `${EmotionCode}.0`,
    };
  }
  return { characterName, catalogVersion: 1, states };
}

const targetFrames: Record<PetState, number> = {
  idle: 6,
  "running-right": 8,
  "running-left": 8,
  waving: 4,
  jumping: 5,
  failed: 8,
  waiting: 6,
  running: 6,
  review: 6,
};

export type PlannedRow = {
  state: PetState;
  flip: boolean;
  frames: { actionFrame: string; emotionFrame: string }[];
};

export function planFrames(states: NormalizedStates): PlannedRow[] {
  return PET_STATES.map((state) => {
    const selection = states[state];
    const action = actionByCode.get(selection.action);
    if (!action) throw invalidRequest();
    const sourceCount = action.lastFrame + 1;
    return {
      state,
      flip: state === "running-right",
      frames: Array.from({ length: targetFrames[state] }, (_, index) => ({
        actionFrame: `${selection.action}.${index % sourceCount}`,
        emotionFrame: selection.emotion,
      })),
    };
  });
}
