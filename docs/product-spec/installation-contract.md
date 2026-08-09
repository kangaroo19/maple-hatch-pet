# Pet 설치 계약

- 상태: 구현 기준 확정
- 최종 수정: 2026-08-09
- 관련 문서: [Maple Hatch Pet MVP PRD](./mvp.md), [Pet 생성 흐름](./pet-generation-flow.md)

## 1. 목적과 범위

이 문서는 생성이 완료된 Codex sprite v1 Pet을 ChatGPT 데스크톱 앱의 공식 딥링크로 설치하는 외부 계약을 정의한다.

MVP는 Supabase나 다른 데이터베이스를 사용하지 않고 `petId` 같은 설치 식별자를 발급하지 않는다. `npx` CLI, 로컬 파일 직접 설치, 결과·설치 메타데이터 재조회 API도 제공하지 않는다. 서비스는 검증된 스프라이트 시트의 HTTPS URL을 딥링크에 포함하고, 실제 설치와 로컬 파일 관리는 ChatGPT 데스크톱 앱에 맡긴다.

## 2. 지원 표면

| 표면 | MVP 지원 | 설치 및 사용 방식 | 제약 |
|---|---|---|---|
| ChatGPT 데스크톱 앱 | 지원 | `Codex에 설치` 딥링크 | Pet 설치 딥링크 기능이 활성화된 환경에서만 설치 흐름이 열린다. 플로팅 Pet과 활동 트레이를 제공한다. |
| ChatGPT 웹 | 미지원 | MVP 설치 흐름 없음 | 파일 수동 업로드는 이 서비스의 지원 범위가 아니다. |
| Codex IDE 확장 | 미지원 | 없음 | Pet 선택기와 플로팅 Pet을 제공하지 않는다. |

딥링크를 지원하지 않는 환경을 위한 CLI나 로컬 파일 설치 대체 경로는 MVP에 포함하지 않는다.

## 3. 설치 자산 계약

각 생성 결과는 다음 조건을 만족하는 하나의 스프라이트 시트를 사용한다.

- 형식: 투명 배경의 PNG
- 크기: 정확히 `1536 × 1872`
- 최대 파일 크기: 20 MiB
- 셀: `192 × 208`, 8열 × 9행
- sprite version: `1`
- 자산 URL: Vercel Blob 공개 저장소가 발행한 고유한 절대 HTTPS URL
- URL 유효기간: 생성 시각부터 28일

자산 URL은 ChatGPT 데스크톱 앱이 인증 없이 내려받을 수 있어야 한다. 이미 발행한 URL의 이미지 내용을 다른 외형으로 바꾸지 않으며, 다시 생성하면 새로운 고유 URL을 발행한다. 정리 작업은 28일 이상 된 자산을 삭제하고, 모든 자산은 최대 30일 이내 삭제한다.

일반적인 v2 Pet 제작 지침은 16개 look 방향을 사용하지만 NEXON 캐릭터 이미지 API는 해당 방향 이미지를 제공하지 않는다. MVP는 NEXON 공식 이미지 전용·AI 미사용 원칙을 지키기 위한 명시적 예외로 v1을 사용하며 v2 이미지를 추정 생성하지 않는다.

## 4. 딥링크 계약

ChatGPT 데스크톱 앱의 설치 버튼은 다음 공식 형식을 사용한다.

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
- 이름, URL 또는 sprite version이 유효하지 않으면 설치 가능한 결과로 표시하지 않는다.

## 5. 설치 흐름과 실패 처리

1. 서버가 스프라이트 시트를 생성하고 규격을 검증한다.
2. 검증된 시트를 고유한 HTTPS URL로 발행하고 실제로 내려받을 수 있는지 확인한다.
3. 웹은 확인된 URL로 딥링크를 구성한 뒤 `Codex에 설치` 버튼, 28일 만료 안내와 `이미지 삭제 요청` 이메일 링크를 표시한다.
4. 사용자가 버튼을 누르면 ChatGPT 데스크톱 앱의 Pet 설치 흐름을 연다.

자산 생성, 업로드 또는 HTTPS 확인이 실패하면 설치 버튼을 표시하지 않는다. 딥링크가 열리지 않으면 Pet 설치 딥링크가 활성화된 ChatGPT 데스크톱 앱이 필요하다고 안내한다. 서비스는 앱 내부 설치 실패를 우회해 로컬 Pet 파일을 직접 만들거나 부분적으로 교체하지 않는다.

삭제 요청 링크는 `mailto:1000jjj@naver.com`을 사용하고 제목을 `Maple Hatch Pet 이미지 삭제 요청`, 본문을 `삭제할 생성 이미지 URL: <spritesheetUrl>`로 미리 채운다. 화면에는 원본 URL을 별도 텍스트로 노출하지 않는다. 생성 결과는 새로고침 후 복원하지 않으므로 사용자가 조기 삭제를 원하면 성공 화면에서 요청해야 한다.

## 6. 설치 완료 조건

- 검증된 스프라이트 시트만 딥링크의 `imageUrl`로 사용한다.
- `imageUrl`은 ChatGPT 데스크톱 앱에서 내려받을 수 있는 절대 HTTPS URL이다.
- 생성 성공 후 같은 화면에는 `Codex에 설치` 버튼, 28일 안내와 이메일 삭제 요청 링크를 표시한다.
- Supabase, 데이터베이스, `petId`, 설치·결과 조회 API, `npx` 명령, 로컬 `pet.json` 계약과 수동 설치 경로를 제공하지 않는다.
- 실제 ChatGPT 데스크톱 앱에서 URL 인코딩, 다운로드와 v1 설치가 완료되는 smoke test를 통과한다.
- ChatGPT 웹과 Codex IDE 확장을 지원 표면으로 안내하지 않는다.

## 7. 기준 자료

- [Codex 딥링크 명령 레퍼런스](https://learn.chatgpt.com/docs/reference/commands#pets)
- [Codex Pets 공식 문서](https://learn.chatgpt.com/docs/pets)
