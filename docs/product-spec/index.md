# Maple Hatch Pet 제품 스펙

- 상태: 초안 — 제품 결정 반영 완료, 문서 리뷰 대기
- 최종 수정: 2026-07-26
- 현재 범위: 공개 웹서비스 MVP

## 문서 지도

1. [MVP PRD](./mvp.md) — 사용자 문제, 제품 범위, 기능 요구사항, 설치 계약과 완료 조건
2. [Pet 생성 흐름](./pet-generation-flow.md) — 생성 버튼 이후의 서버 비즈니스 로직, 단계별 산출물과 실패 처리

새 문서는 구현이나 운영에 독립적인 결정이 생겼을 때만 추가한다. 이 인덱스는 문서의 읽기 순서와 현재 상태만 짧게 유지한다.

## 제품 한 줄 설명

Maple Hatch Pet은 메이플스토리 캐릭터 닉네임을 입력하면 NEXON Open API의 현재 외형과 공식 액션 프레임으로 Codex용 v1 Pet을 만들고, 딥링크 클릭 또는 한 줄 `npx` 명령으로 설치할 수 있게 하는 공개 웹서비스다.

## 기준 자료

- [Harness Engineering: Codex in an agent-first world](https://openai.com/ko-KR/index/harness-engineering/)
- [Codex 딥링크 명령 레퍼런스](https://learn.chatgpt.com/docs/reference/commands)
- [Codex Pets 공식 문서](https://learn.chatgpt.com/docs/pets)
- [NEXON 메이플스토리 Open API](https://openapi.nexon.com/game/maplestory/)
- [NEXON 캐릭터 이미지 액션·표정 프레임 안내](https://openapi.nexon.com/support/notice/2715682/)
