# Pet 설치 계약

- 상태: 초안 — 제품 결정 반영 완료, 문서 리뷰 대기
- 최종 수정: 2026-07-26
- 관련 문서: [Maple Hatch Pet MVP PRD](./mvp.md), [Pet 생성 흐름](./pet-generation-flow.md)

## 1. 목적과 범위

이 문서는 생성이 완료된 Codex sprite v1 Pet을 ChatGPT 데스크톱 앱에 설치하는 외부 계약을 정의한다.

외부 API와 웹 문서에서는 설치·결과 조회 식별자를 `petId`라고 부른다. 일반 문장에서는 Pet ID, CLI 자리표시자와 경로 예시에서는 `<pet-id>`를 사용한다. 로컬 `pet.json`의 `id`는 Codex 매니페스트가 요구하는 필드 이름이므로 예외로 유지하되 값은 `petId`와 같아야 한다.

## 2. 지원 표면

| 표면 | MVP 지원 | 설치 및 사용 방식 | 제약 |
|---|---|---|---|
| ChatGPT 데스크톱 앱 | 지원 | 설치 딥링크 또는 같은 컴퓨터에서 `npx` 설치 후 Pets 새로고침 | 딥링크 기능이 활성화된 환경에서만 설치 흐름이 열린다. 플로팅 Pet과 활동 트레이를 제공한다. |
| ChatGPT 웹 | 미지원 | MVP 설치 흐름 없음 | 로컬 Pet과 자동 동기화되지 않는다. 파일 수동 업로드는 이 서비스의 지원 범위가 아니다. |
| Codex IDE 확장 | 미지원 | 없음 | Pet 선택기와 플로팅 Pet을 제공하지 않는다. |

## 3. 설치 자산 계약

딥링크와 CLI는 하나의 생성 결과에 속한 동일한 스프라이트 시트 자산을 사용해야 한다.

- 형식: 투명 배경의 PNG 또는 lossless WebP
- 크기: 정확히 `1536 × 1872`
- 최대 파일 크기: 20 MiB
- 셀: `192 × 208`, 8열 × 9행
- sprite version: `1`
- 자산 URL: 서비스가 발행한 절대 HTTPS URL

생성 성공마다 새 `petId`와 고유한 자산 URL을 발급한다. 발행된 `petId`의 이미지 자산을 다른 외형으로 바꾸지 않는다.

## 4. 딥링크 계약

ChatGPT 데스크톱 앱의 설치 버튼은 다음 형식을 사용한다.

```text
codex://pets/install?name=<encoded-name>&imageUrl=<encoded-https-url>&description=<encoded-description>&spriteVersionNumber=1
```

- `name`과 `imageUrl`은 필수다.
- `name`은 공백이 아닌 문자를 한 개 이상 포함한다.
- `imageUrl`은 생성된 v1 시트의 절대 HTTPS URL이다.
- `description`은 선택 값이다.
- `spriteVersionNumber`는 `1`을 명시한다.
- 모든 쿼리 값은 각각 URI 인코딩한다.
- 공식 허용 파라미터 외의 값이나 추가 경로를 넣지 않는다.
- 딥링크를 열 수 없을 때 결과 화면에 있는 CLI 명령을 대체 경로로 안내한다.

## 5. npx 설치 도구 계약

사용자 명령은 다음 한 줄이다.

```bash
npx maple-hatch-pet add <pet-id>
```

`npx` 설치 도구는 다음 순서로 동작한다.

1. `petId`만 입력으로 받고 사용자가 제공한 URL은 받지 않는다.
2. 서비스에서 `petId`에 해당하는 설치 메타데이터를 HTTPS로 조회한다.
3. 응답의 `petId`가 요청 값과 같은지 확인한다.
4. 서비스가 허용한 HTTPS 자산 URL에서 스프라이트 시트를 임시 위치로 내려받는다.
5. 이미지 형식, 크기, 용량, 알파 채널과 v1 행·셀 구조를 검증한다.
6. 로컬 `pet.json`을 만들고 스프라이트 시트와 함께 임시 디렉터리에서 다시 검증한다.
7. 모든 검증이 성공한 경우에만 완성된 디렉터리를 `~/.codex/pets/<pet-id>/`로 교체한다.
8. 설치 완료 후 ChatGPT 데스크톱 앱의 새로고침·선택 방법을 출력한다.

다운로드, 검증 또는 교체가 실패하면 임시 파일을 정상 Pet으로 노출하지 않고 기존 동일 ID 디렉터리를 보존한다. 동일 `petId`를 다시 설치하는 경우에도 검증된 전체 디렉터리 단위로만 교체하며 파일별 부분 덮어쓰기를 금지한다.

## 6. 로컬 파일 계약

기본 설치 위치는 다음과 같다.

```text
~/.codex/pets/<pet-id>/
├── pet.json
└── spritesheet.webp
```

PNG를 설치하는 경우 `spritesheetPath`와 실제 파일 확장자를 함께 `spritesheet.png`로 바꾼다.

v1 `pet.json`은 다음 구조를 사용한다.

```json
{
  "id": "<pet-id>",
  "displayName": "천짱",
  "description": "루나 제논 캐릭터",
  "spritesheetPath": "spritesheet.webp",
  "kind": "creature"
}
```

- `id`는 서비스 응답의 `petId`와 정확히 같아야 한다.
- `displayName`은 Pet 선택기에 표시할 이름이다.
- `description`은 캐릭터의 월드와 직업을 사용한 짧은 설명이다.
- `spritesheetPath`는 같은 디렉터리 안의 파일명만 가리킨다. 절대 경로나 상위 경로를 사용할 수 없다.
- `kind`는 `creature`로 고정한다.
- v1은 `spriteVersionNumber`를 생략하면 기본값 `1`을 사용한다.

## 7. 원자성과 실패 복구

- 대상 디렉터리와 같은 파일 시스템에 임시 디렉터리를 만든다.
- 이미지와 `pet.json`을 모두 임시 디렉터리에 쓴 뒤 검증한다.
- 교체 직전까지 기존 동일 ID 디렉터리를 변경하지 않는다.
- 플랫폼이 제공하는 디렉터리 rename과 백업 복구 절차를 사용해 전체 디렉터리를 한 단위로 교체한다.
- 교체 중 실패하면 기존 디렉터리를 복구하고 임시 디렉터리를 정상 설치로 표시하지 않는다.
- 설치 성공 뒤에만 이전 백업과 임시 파일을 정리한다.

## 8. 설치 후 안내

### ChatGPT 데스크톱 앱

1. 프로필 메뉴 또는 Settings에서 Pets를 연다.
2. Refresh를 선택한다.
3. 설치한 Pet을 선택한다.
4. `/pet` 또는 명령 메뉴의 Wake Pet으로 플로팅 Pet을 표시한다.

## 9. 설치 완료 조건

- 딥링크와 CLI가 동일한 생성 자산을 설치한다.
- `npx` 설치 도구는 임의 URL을 받지 않고 서비스가 반환한 허용된 HTTPS 자산만 내려받는다.
- 로컬 `pet.json`의 `id`와 요청한 `petId`가 일치한다.
- 설치가 실패해도 기존 동일 ID Pet의 파일이 일부만 바뀌지 않는다.
- ChatGPT 웹과 Codex IDE 확장을 지원 표면으로 안내하지 않는다.
