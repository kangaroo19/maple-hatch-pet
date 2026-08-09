# Maple Hatch Pet 제품 스펙

- 상태: 구현 기준 확정
- 최종 수정: 2026-08-09
- 현재 범위: 공개 웹서비스 MVP

## 문서 지도

1. [MVP PRD](./mvp.md) — 사용자 문제, 제품 범위, 기능 요구사항과 완료 조건
2. [액션·표정 카탈로그](./action-emotion-catalog.md) — UI와 서버가 공유하는 버전 1 코드, 공식 영문명, 한국어 표시명과 프레임 범위
3. [Pet 생성 흐름](./pet-generation-flow.md) — 조회·생성·정리 API, 단계별 산출물과 실패 처리
4. [Pet 설치 계약](./installation-contract.md) — v1 딥링크, 설치 자산, 만료 안내와 지원 표면

새 문서는 구현이나 운영에 독립적인 결정이 생겼을 때만 추가한다. 이 인덱스는 문서의 읽기 순서와 현재 상태만 짧게 유지한다.

## 제품 한 줄 설명

Maple Hatch Pet은 메이플스토리 캐릭터 닉네임을 입력하면 NEXON Open API의 현재 외형과 공식 액션 프레임으로 Codex용 v1 Pet을 만들고, ChatGPT 데스크톱 앱의 딥링크로 설치할 수 있게 하는 공개 웹서비스다.

## 기준 자료

- [Harness Engineering: Codex in an agent-first world](https://openai.com/ko-KR/index/harness-engineering/)
- [Codex 딥링크 명령 레퍼런스](https://learn.chatgpt.com/docs/reference/commands#pets)
- [Codex Pets 공식 문서](https://learn.chatgpt.com/docs/pets)
- [NEXON 메이플스토리 Open API](https://openapi.nexon.com/game/maplestory/)
- [NEXON 캐릭터 이미지 액션·표정 프레임 안내](https://openapi.nexon.com/support/notice/2715682/)
- [NEXON Open API 이용약관](https://openapi.nexon.com/support/terms/)
- [NEXON Open API 사용 안내](https://openapi.nexon.com/guide/request-api/)
