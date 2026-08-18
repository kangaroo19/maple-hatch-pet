# MapLogin NewChar 버튼 에셋·배치 변경 실행계획

- 상태: 구현 완료
- 기준 화면: KMS v1.2.43 MapLogin의 두 번째 화면
- 목적: `Pet 만들기`와 `다른 캐릭터 찾기`의 Canvas 에셋과 좌표를 원본 WZ 버튼 기준으로 교체한다.

## 1. 확정된 계약

- `Pet 만들기`는 실제 WZ 경로 `UI.wz/Login.img/CharSelect/BtNew`의 `101 × 35` 버튼을 사용한다.
- `Pet 만들기`는 `scroll-open-3.png`의 `242 × 165` 하단에서 `15px` 여백을 두고 가로 중앙에 배치한다.
- 생성 성공 후 같은 컨트롤이 `설치 정보` 역할을 할 때도 `BtNew` 에셋을 유지한다.
- `다른 캐릭터 찾기`는 실제 WZ 경로 `UI.wz/Login.img/Common/BtStart`의 `125 × 52` 버튼을 사용한다.
- `다른 캐릭터 찾기`는 `800 × 600` 논리 viewport의 `(8, 429)`에 고정하고 `Common/frame` 다음에 렌더링한다.
- 두 버튼은 WZ 이미지 원문만 그리며 별도 Canvas 텍스트를 덧그리지 않는다.
- 화면 밖 native 버튼의 접근성 이름, 키보드 입력과 실행 동작은 유지한다.

이전 요청에 적힌 `Btstart`는 실제 v43 WZ의 대소문자와 달라 `BtStart`를 사실 기준으로 사용한다. `BtNew`는 실제 경로와 대소문자가 일치한다. 첨부 이미지는 저장소에 복사하지 않으며, 이미지의 `420 × 315` 좌표에서 확인한 버튼 외곽 `(4..62, 225..243)`을 논리 화면으로 환산한 `(8, 429)`만 secondary 배치 근거로 남긴다.

## 2. 자산과 manifest

1. `scripts/extract-map-login-assets.cjs`가 `Login.img`에서 두 제품 버튼을 추출한다.
2. 두 버튼의 `normal`, `mouseOver`, `pressed`, `disabled` PNG를 `public/map-login/kms-v43/new-char/`에 추출한다.
3. `new-char.json`은 `formatVersion: 3`이며 `source.login`, `buttons.petCreate`, `buttons.findCharacter`를 필수 계약으로 둔다.
4. 추출기와 런타임 validator가 각각 `101 × 35`, `125 × 52`와 네 상태를 검증한다.
5. 설치 모달에서 사용하는 기존 `Basic.img/Tab` 자산은 유지한다.

## 3. 레이아웃·렌더링·입력

1. `getNewCharLayout`이 manifest를 받아 원본 버튼 크기로 rect를 계산한다.
2. primary는 정수 픽셀 기준 `scroll.x + 70`, `scroll.y + 115`에 둔다. 좌우 여백은 각각 `70px`, `71px`이며 하단 여백은 `15px`이다.
3. secondary는 카메라와 독립된 viewport rect `{ x: 8, y: 429, width: 125, height: 52 }`로 둔다.
4. primary는 맵 좌표로, secondary는 논리 viewport 좌표로 hit test한다.
5. secondary는 양피지 열림이 끝난 편집 화면에서만 표시하고 닫힘 전환과 설치 모달 중에는 숨긴다.
6. 합성 순서는 장면·NewChar UI, `Common/frame`, secondary 버튼 순서로 고정한다.

## 4. 문서와 검증

- `docs/frontend/index.md`와 `docs/frontend/implementation-guide.md`의 버튼 자산, 좌표, 합성 순서와 `new-char.json` v3 계약을 갱신한다.
- manifest v3의 상태·크기·필수 필드, primary 하단 중앙 좌표, secondary 고정 좌표와 좌표계별 hit test를 Vitest로 검증한다.
- 숨김 native 버튼의 생성, 설치 정보 재열기와 다른 캐릭터 찾기 동작 테스트를 유지한다.
- 브라우저 실행, 실제 렌더링 확인, 스크린샷 비교, E2E와 빌드는 사용자의 별도 요청 없이는 실행하지 않는다.

## 5. 완료 조건

- 버전된 정적 자산과 manifest가 같은 변경에 포함된다.
- 두 버튼의 네 상태가 원본 크기로 렌더링되고 포인터·키보드 동작이 기존 기능과 일치한다.
- secondary 버튼은 카메라 이동과 무관하게 `(8, 429)`에서 프레임 위에 표시된다.
- 관련 단위 테스트와 타입 검사가 통과하고 프론트엔드 문서가 구현과 일치한다.
