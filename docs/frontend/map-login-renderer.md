# MapLogin 렌더러 기술 명세

- 상위 문서: [MapLogin 프런트엔드 구현 문서](./index.md)
- 기준 구현: [`poc/map-login/`](../../poc/map-login/)
- manifest 버전: `formatVersion: 1`

## 1. 목적과 경계

이 문서는 `poc/map-login/`이 KMS v1.2.43의 WZ 데이터를 브라우저에서 스크롤·애니메이션 가능한 MapLogin 장면으로 복원하는 계약을 설명한다.

PoC는 완성된 맵 이미지를 추출하지 않는다. Node.js 추출기가 WZ의 배치와 Canvas 프레임을 브라우저용 manifest와 개별 PNG로 변환하고, 브라우저가 매 프레임 현재 카메라에 맞춰 다시 합성한다.

```text
UI.wz/MapLogin.img        맵 크기, 배경과 오브젝트 배치
UI.wz/Login.img           Notice 배경과 확인 버튼
Map.wz/Back/login.img     배경 Canvas와 애니메이션
Map.wz/Obj/login.img      오브젝트 Canvas와 애니메이션
          │
          ▼
extract.cjs
          │
          ├─ public/generated/scene.json
          ├─ public/generated/notice.json
          └─ public/generated/assets/*.png
                              │
                              ▼
                  scene-utils.js + app.js
                              │
                              ▼
                  Canvas 장면 + Notice 경고 UI
```

실제 로그인 패널의 외형, 월드 선택과 인증 UI는 이 계약에 포함되지 않는다. PoC의 CSS 입력 폼은 조회 상태와 공통 경고 동작만 검증하며 제품 로그인 패널의 시각 기준으로 사용하지 않는다.

## 2. 파일별 책임

| 파일 | 책임 |
|---|---|
| [`extract.cjs`](../../poc/map-login/extract.cjs) | WZ 파싱, 링크 해석, PNG 추출, `scene.json`·`notice.json` 생성 |
| [`public/scene-utils.js`](../../poc/map-login/public/scene-utils.js) | 프레임 선택, 배경 type 판정, 배경 좌표 계산 |
| [`public/app.js`](../../poc/map-login/public/app.js) | 에셋 로드, Canvas 합성, 모의 조회 상태와 Notice 다이얼로그 관리 |
| [`public/index.html`](../../poc/map-login/public/index.html) | 스크롤 뷰포트, sticky Canvas, 모의 로그인 폼과 경고 UI |
| [`serve.cjs`](../../poc/map-login/serve.cjs) | `public/` 아래 정적 파일만 제공하는 로컬 서버 |
| [`verify.cjs`](../../poc/map-login/verify.cjs) | 장면 계산과 추출된 Notice manifest·PNG 계약 검증 |

추출 단계와 브라우저 런타임 사이의 데이터 계약은 `scene.json`, `notice.json`과 두 manifest가 참조하는 PNG다. 브라우저는 WZ 파일이나 `@tybys/wz`를 직접 읽지 않는다.

## 3. WZ 추출 과정

### 3.1 입력과 파싱

추출기는 `KMS_WZ_DIR` 아래의 `UI.wz`, `Map.wz`, `ZLZ.dll` 존재를 먼저 확인한다. `WzMapleVersion.GETFROMZLZ`와 패치 버전 `43`을 사용하므로 암호화 키는 같은 디렉터리의 `ZLZ.dll`에서 얻는다.

다음 이미지를 순서대로 파싱한다.

- `UI.wz/MapLogin.img`
- `UI.wz/Login.img`
- `Map.wz/Back/login.img`
- `Map.wz/Obj/login.img`

같은 `WzFile`의 `WzImage`는 위치 기반 reader를 공유하므로 동시에 파싱하지 않는다. 이 순차 파싱은 단순 성능 선택이 아니라 reader 위치 충돌을 막기 위한 제약이다.

### 3.2 맵 좌표

`MapLogin.img/miniMap`에서 다음 값을 읽는다.

```ts
type SceneMap = {
  width: number
  height: number
  centerX: number
  centerY: number
}
```

이 값들은 맵 좌표를 화면 좌표로 옮기는 기준이다. 특정 추출 결과의 `849×2349` 같은 크기를 제품 코드에 상수로 넣지 않는다.

### 3.3 Canvas 링크와 에셋 중복 제거

프레임 노드는 직접 `WzCanvasProperty`일 수도 있고 UOL일 수도 있다. 추출기는 UOL을 실제 대상으로 반복해서 따라가며 같은 UOL을 다시 방문하면 순환 참조 오류로 중단한다.

Canvas에 `_inlink`가 있으면 현재 `WzImage` 내부에서 대상을 찾는다. `_outlink`, `_inlink` 또는 직접 Canvas는 `getLinkedWzCanvasBitmap()`이나 PNG property 저장을 통해 PNG로 만든다.

중복 제거 키의 우선순위는 다음과 같다.

1. `_outlink`가 있으면 `outlink:<경로>`
2. `_inlink`가 있으면 현재 image 전체 경로와 inlink 경로의 조합
3. 링크가 없으면 Canvas의 전체 WZ 경로

같은 키는 하나의 `asset-0000.png`를 공유한다. manifest의 각 프레임은 해당 PNG 상대 경로만 참조한다.

### 3.4 프레임 추출

Canvas 또는 UOL 자체는 단일 프레임으로 취급한다. 그 밖의 리소스에서는 숫자로만 된 자식을 숫자 순서로 정렬해 모든 프레임을 추출한다.

프레임 계약은 다음과 같다.

```ts
type SceneFrame = {
  asset: string
  width: number
  height: number
  delay: number
  origin: { x: number; y: number }
  z: number
  a0: number
  a1: number
  uol: string | null
  inlink: string | null
  outlink: string | null
}
```

기본값은 다음과 같다.

- `delay`: WZ 값이 없으면 `100ms`, 최솟값 `1ms`
- `origin`: `{ x: 0, y: 0 }`
- `z`: `0`
- `a0`: `255`
- `a1`: 값이 없으면 `a0`
- 연결 정보: 없으면 `null`

`origin`은 이미지 왼쪽 위가 아니라 배치 기준점에서 이미지가 얼마나 떨어지는지 나타낸다. 렌더링 시 이미지 좌표는 `anchor - origin`이다.

## 4. `scene.json` 계약

최상위 구조는 다음과 같다.

```ts
type MapLoginScene = {
  formatVersion: 1
  source: {
    map: 'UI.wz/MapLogin.img'
    back: 'Map.wz/Back/login.img'
    object: 'Map.wz/Obj/login.img'
    patchVersion: 43
    keySource: 'ZLZ.dll'
    library: '@tybys/wz@1.7.1'
  }
  map: SceneMap
  backgrounds: SceneBackground[]
  objects: SceneObject[]
  stats: SceneStats
}
```

`source`와 `stats`는 출처 확인과 진단 정보다. 실제 화면 계산은 `map`, `backgrounds`, `objects`를 사용한다.

### 4.1 배경 배치

```ts
type SceneBackground = {
  id: string
  source: string
  order: number
  front: number
  ani: number
  no: string
  x: number
  y: number
  z: number
  rx: number
  ry: number
  cx: number
  cy: number
  type: number
  f: number
  a: number
  frames: SceneFrame[]
}
```

- `front`가 참이면 오브젝트 뒤가 아니라 모든 오브젝트 다음에 그린다.
- `ani`가 참이면 `Back/login.img/ani/<no>`, 아니면 `back/<no>`를 참조한다.
- `cx`, `cy`가 0이면 PNG의 실제 너비와 높이를 반복 간격으로 사용한다.
- `f`는 수평 뒤집기 여부, `a`는 배치 전체 alpha다.

### 4.2 오브젝트 배치

```ts
type SceneObject = {
  id: string
  source: string
  layer: number
  order: number
  x: number
  y: number
  z: number
  f: number
  a: number
  frames: SceneFrame[]
}
```

리소스 경로는 placement의 `l0/l1/l2`를 `/`로 연결해 `Obj/login.img`에서 찾는다. 추출 후 정렬은 다음 순서다.

```text
layer 오름차순 → z 오름차순 → 원본 배치 order 오름차순
```

### 4.3 통계

`stats`에는 배경, 오브젝트, 고유 PNG, 애니메이션, 이동 배경과 링크 프레임 수가 기록된다. UI 상태와 추출 진단에 사용할 수 있지만 렌더링 분기를 통계값에 의존시키지 않는다.

### 4.4 `notice.json` 계약

공통 경고 UI는 `scene.json`과 독립된 `notice.json`을 사용한다. 기존 장면 계약은 변경하지 않는다.

```ts
type NoticeAsset = {
  asset: string
  width: number
  height: number
  source: string
}

type NoticeManifest = {
  formatVersion: 1
  source: {
    notice: 'UI.wz/Login.img/Notice'
    patchVersion: 43
    keySource: 'ZLZ.dll'
    library: '@tybys/wz@1.7.1'
  }
  frame: {
    width: 362
    height: 219
    background: NoticeAsset
  }
  confirm: {
    normal: NoticeAsset
    mouseOver: NoticeAsset
    pressed: NoticeAsset
  }
}
```

배경은 `Notice/backgrnd/1`, 버튼은 `Notice/BtYes`의 세 상태를 사용한다. 오류 문구는 WZ의 `Notice/text/*`를 추출하지 않고 고정된 메시지 영역에 최대 세 줄의 plain text로 렌더링한다.

## 5. 브라우저 레이아웃과 세로 스크롤

`#viewport`는 고정된 화면 높이와 `overflow: auto`를 가진다. `#scroll-space`의 CSS 높이는 `scene.map.height × scale`이며 전체 맵의 스크롤 범위를 만든다.

Canvas는 `position: sticky; top: 0`이다. 따라서 긴 Canvas 전체를 만들지 않고 현재 보이는 논리 높이만 그리면서도 사용자는 전체 맵을 직접 스크롤할 수 있다.

`resize()`의 계산은 다음과 같다.

```text
scale = viewport.clientWidth / map.width
logicalViewHeight = min(map.height, ceil(viewport.clientHeight / scale))
deviceScale = min(devicePixelRatio, 2)

canvas bitmap width  = ceil(map.width × deviceScale)
canvas bitmap height = ceil(logicalViewHeight × deviceScale)
canvas CSS height    = logicalViewHeight × scale
scroll-space height  = map.height × scale
```

`scale`은 CSS 픽셀과 맵 논리 좌표의 비율이고 `deviceScale`은 Canvas bitmap 선명도를 위한 DPR이다. 두 값을 섞지 않는다.

## 6. 카메라 좌표

매 렌더 프레임에 `viewport.scrollTop`을 맵 논리 좌표로 바꾼다.

```text
sceneTop = viewport.scrollTop / scale

camera.left    = -map.centerX
camera.top     = sceneTop - map.centerY
camera.centerX = -map.centerX + map.width / 2
camera.centerY = sceneTop - map.centerY + logicalViewHeight / 2
```

오브젝트의 화면 anchor는 다음과 같다.

```text
screenX = object.x - camera.left
screenY = object.y - camera.top
```

배경은 type에 따른 이동과 패럴랙스를 먼저 계산한 뒤 `camera.left`, `camera.top`을 뺀다. 현재 PoC 렌더러 자체에는 자동 카메라 왕복이나 제품 화면 전환이 없으므로 카메라의 세로 위치는 사용자 스크롤만으로 바뀐다. 제품 통합에서는 조회 성공과 `다른 캐릭터 찾기`에 한해 [제품 구현 가이드](./implementation-guide.md#제품-ui-계약)의 일회성 자동 스크롤을 추가한다.

## 7. 애니메이션과 alpha

### 7.1 프레임 선택

`frameAtTime()`은 모든 프레임 delay의 합을 한 주기로 사용한다.

```text
totalDelay = Σ max(1, frame.delay || 100)
cursor = elapsedMs mod totalDelay
```

cursor에서 프레임 delay를 순서대로 빼 첫 번째로 범위에 들어오는 프레임을 선택한다. 함께 반환하는 `progress`는 현재 프레임 안에서 `0` 이상 `1` 미만인 진행률이다.

### 7.2 alpha 보간

현재 프레임의 alpha는 다음과 같다.

```text
frameAlpha = a0 + (a1 - a0) × progress
finalAlpha = placement.a / 255 × frameAlpha / 255
```

Canvas의 `globalAlpha`에는 `0..1`로 제한한 값을 넣는다. `a0/a1`을 프레임 전환용 별도 이미지로 오해하지 않는다.

### 7.3 origin과 수평 뒤집기

렌더러는 anchor로 이동한 뒤 `f`가 참이면 x축을 `-1`로 뒤집고 이미지를 `(-origin.x, -origin.y)`에 그린다. 뒤집기 전에 화면 좌표에서 이미지 폭을 임의로 빼지 않는다.

## 8. 배경 type과 위치 계산

현재 PoC의 type 해석은 다음과 같다.

| type | 가로 반복 | 세로 반복 | 가로 이동 | 세로 이동 |
|---:|:---:|:---:|:---:|:---:|
| 0 |  |  |  |  |
| 1 | O |  |  |  |
| 2 |  | O |  |  |
| 3 | O | O |  |  |
| 4 | O |  | O |  |
| 5 |  | O |  | O |
| 6 | O | O | O |  |
| 7 | O | O |  | O |

type 6과 7은 모두 양방향으로 타일링하지만 이동 축이 다르다.

### 8.1 이동 축

이동 축은 다음 공식을 사용하고 타일 간격으로 순환시킨다.

```text
x += (rx × 5 × elapsedMs / 1000) mod cellWidth
y += (ry × 5 × elapsedMs / 1000) mod cellHeight
```

type 4와 6은 x 공식을, type 5와 7은 y 공식을 사용한다.

### 8.2 이동하지 않는 축의 패럴랙스

이동하지 않는 축은 카메라 중심과 `rx/ry` 비율을 사용한다.

```text
x += camera.centerX × (100 + rx) / 100
y += camera.centerY × (100 + ry) / 100
```

마지막으로 카메라의 왼쪽과 위쪽을 빼 화면 좌표로 바꾸고 정수 좌표로 내림한다.

### 8.3 타일 범위

반복 간격은 `cx || image.width`, `cy || image.height`다. 가로 반복은 전체 맵 너비를 덮도록, 세로 반복은 현재 `logicalViewHeight`를 덮도록 시작 행·열과 마지막 행·열을 계산한다. 양 끝에 한 칸의 여유를 추가해 이동 중 빈 틈이 생기지 않게 한다.

## 9. 합성 순서와 렌더 루프

`requestAnimationFrame` 루프는 다음 순서를 반복한다.

1. 시작 시각으로부터 `elapsedMs`를 계산한다.
2. 현재 `scrollTop`으로 카메라를 계산한다.
3. Canvas transform을 현재 `deviceScale`로 다시 설정한다.
4. 배경색으로 현재 화면을 지운다.
5. `front`가 거짓인 배경을 원본 순서대로 그린다.
6. `layer`, `z`, `order`로 정렬된 오브젝트를 그린다.
7. `front`가 참인 배경을 원본 순서대로 그린다.
8. 다음 animation frame을 요청한다.

`setTransform()`을 매 프레임 사용하므로 이전 프레임의 scale이 누적되지 않는다. 애니메이션은 스크롤 이벤트에 묶이지 않아 사용자가 멈춘 위치에서도 계속 진행된다.

## 10. 로딩과 오류 처리

브라우저는 `generated/scene.json`과 `generated/notice.json`을 `no-store`로 요청하고 manifest가 참조하는 고유 PNG 경로를 모두 먼저 로드한다. 모든 이미지 로드가 끝난 뒤에만 렌더 루프와 모의 로그인 폼을 시작한다.

manifest 또는 PNG 로드에 실패하면 다음 동작을 한다.

- 오류를 console에 기록한다.
- Canvas를 숨긴다.
- 내부 오류는 console에만 남기고 `#fatal`에는 새로고침을 안내하는 일반 텍스트만 표시한다.
- 상태 텍스트를 `장면 로드 실패`로 바꾼다.

PoC는 일부 에셋만 빠진 장면을 계속 그리는 부분 성공을 지원하지 않는다.

## 11. 근사와 알려진 한계

- 이동 배경의 `속도값 × 5 × 경과시간(초)` 공식은 WzComparerR2 MapRender 공개 구현을 따른다. 원본 KMS 클라이언트 바이너리에서 직접 검증한 공식이 아니다.
- PoC의 레이어 순서는 `front`, 오브젝트 map layer, placement `z`, 원본 order로 복원한 결과다.
- 모의 로그인 폼은 조회 중·인라인 검증·경고 다이얼로그 상태 전이만 검증한다. 실제 로그인 패널 외형, 월드 선택, 인증과 NEXON API 호출은 구현하지 않는다.
- Spine, 파티클과 맵 오브젝트 이동 노드는 현재 MapLogin 데이터에 필요하지 않아 처리하지 않는다.
- 정적 서버와 생성물 경로는 로컬 기술 확인용이다. 제품의 빌드·배포 계약으로 그대로 채택된 것이 아니다.
- 브라우저는 모든 PNG를 선로드한다. 대규모 범용 맵 지원 시에는 로딩과 메모리 전략을 다시 설계해야 한다.

제품 코드로 옮길 때의 구체적인 경계와 순서는 [제품 구현 가이드](./implementation-guide.md)를 따른다.
