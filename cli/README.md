# Maple Hatch Pet CLI

Maple Hatch Pet에서 생성한 Codex Pet 패키지를 현재 사용자의 Codex Pet 디렉터리에 설치하는 CLI입니다.

## 요구사항

- Node.js 24.x
- npm
- 패키지를 내려받을 수 있는 네트워크 연결

## 사용법

Maple Hatch Pet 웹에서 생성 결과로 받은 명령을 터미널에서 실행합니다.

```bash
npx maple-hatch-pet add <petId>
```

MVP에서는 `add` 명령만 지원합니다. 목록, 검색, 업데이트, 삭제와 `--force` 옵션은 제공하지 않습니다. 같은 `petId`를 다시 설치하면 검증된 새 패키지로 안전하게 교체합니다.

설치가 완료되면 Codex 데스크톱의 Settings > Pets에서 Refresh를 누른 뒤 Pet을 선택합니다.

## 패키지 만료

생성된 Pet 패키지는 28일 동안 설치할 수 있습니다. 패키지가 만료됐거나 존재하지 않는다는 메시지가 표시되면 [Maple Hatch Pet](https://maple-hatch-pet.vercel.app)에서 Pet을 다시 생성해 새 명령을 사용하세요.

## 문제 보고

문제가 계속되면 [GitHub Issues](https://github.com/kangaroo19/maple-hatch-pet/issues)에 재현 절차와 CLI 오류 메시지를 남겨 주세요. API 키, 토큰, 전체 로컬 경로와 내려받은 패키지 내용은 첨부하지 마세요.

## 라이선스

[MIT](./LICENSE)
