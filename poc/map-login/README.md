# MapLogin.wz Browser PoC

KMS v1.2.43의 `UI.wz/MapLogin.img` 배치 정보와 이 맵이 참조하는
`Map.wz/Back/login.img`, `Map.wz/Obj/login.img` 리소스를
`@tybys/wz`로 추출해 브라우저 Canvas에서 합성하는 기술 확인용 PoC다.
`UI.wz/Login.img/Notice`의 공통 경고 프레임과 확인 버튼도 함께 추출한다.
거대한 완성 이미지를 미리 만들지 않고 개별 PNG, `scene.json`, `notice.json`을 생성한다.

## 설치 및 실행

PowerShell에서 저장소 루트를 기준으로 실행한다.

```powershell
$env:KMS_WZ_DIR='C:\Users\82103\Downloads\KMS v1.2.43_clean\KMS_v2.43'
npm --prefix poc\map-login install --ignore-scripts
npm --prefix poc\map-login run extract
npm --prefix poc\map-login run verify
npm --prefix poc\map-login run serve
```

브라우저에서 <http://127.0.0.1:4173/>을 연다. 맵은 자동 이동하지 않는다.
마우스 휠, 스크롤바 또는 터치 스크롤로 위에서 아래까지 직접 이동한다.

장면 위의 폼은 조회 상태와 공통 경고 다이얼로그를 확인하기 위한 모의 UI다.

- 빈 입력은 입력란 아래에 인라인 오류를 표시한다.
- `없는캐릭터`는 캐릭터 없음 경고를 표시한다.
- `서버오류`는 일시적인 서버 오류 경고를 표시한다.
- 그 밖의 닉네임은 모의 조회 성공으로 처리한다.

`verify`는 장면 계산과 추출된 `notice.json`의 출처·크기·PNG 존재 여부를 검증하므로
`extract` 다음에 실행한다.

```powershell
npm --prefix poc\map-login run verify
```

## 처리한 WZ 속성

- 맵 좌표: `miniMap.width`, `miniMap.height`, `centerX`, `centerY`
- 배치와 순서: `x`, `y`, `z`, 맵 레이어, `origin`, `front`, `f`, `a`
- 애니메이션: `ani`, 숫자 이름의 모든 프레임, 프레임별 `delay`
- 프레임 표시: `a0`, `a1` alpha 보간
- 배경: `type` 0~7, `rx`, `ry`, `cx`, `cy`
- 연결: UOL을 실제 대상으로 해석하며 `_inlink`, `_outlink` Canvas를 따라간다.
  같은 원본 Canvas는 한 번만 추출한다.
- 공통 경고: `Login.img/Notice/backgrnd/1`과 `BtYes`의 `normal`, `mouseOver`,
  `pressed` 상태를 추출한다. 경고 문구는 PNG가 아니라 브라우저 plain text로 표시한다.

추출기는 KMS 패치 버전 43과 `WzMapleVersion.GETFROMZLZ`를 사용한다.
따라서 WZ 디렉터리의 `ZLZ.dll`에서 키를 읽는다. 원본 WZ와 DLL에는 쓰지 않는다.
생성물은 `public/generated/` 아래에 생기며 `.gitignore`로 제외된다.

## 배경 동작

`type`은 다음과 같이 처리한다.

| type | 처리 |
| ---: | --- |
| 0 | 반복 없음 |
| 1 | 가로 반복 |
| 2 | 세로 반복 |
| 3 | 가로·세로 반복 |
| 4 | 가로 반복 및 `rx` 기반 가로 이동 |
| 5 | 세로 반복 및 `ry` 기반 세로 이동 |
| 6 | 양방향 반복 및 `rx` 기반 가로 이동 |
| 7 | 양방향 반복 및 `ry` 기반 세로 이동 |

이동 축은 WzComparerR2 MapRender의 공개 구현과 같이
`속도값 × 5 × 경과시간(초)`를 사용하고 `cx`/`cy` 간격으로 순환시킨다.
이동하지 않는 축의 `rx`/`ry`는 카메라 중심에 대한 패럴랙스 비율로 적용한다.
이는 원본 KMS 클라이언트 바이너리에서 직접 검증한 공식이 아니라
공개 MapRender 구현을 따른 재현 공식이다.

참고:

- [toyobayashi/wz](https://github.com/toyobayashi/wz)
- [WzComparerR2 MapRender](https://github.com/Kagamia/WzComparerR2)

## 알려진 한계

- 장면 위 로그인 폼은 상태 전이 검증용이며 실제 클라이언트나 제품 로그인 패널의
  외형·인증 동작을 구현한 것이 아니다. NEXON API도 호출하지 않는다.
- Spine, 파티클, 맵 오브젝트 이동 노드는 대상 MapLogin 데이터에 필요하지 않아 처리하지 않는다.
- 레이어 정렬은 배경의 `front`, 오브젝트 맵 레이어, 배치 `z`, 원본 배치 순서를 사용한다.
- 고정된 스크롤 위치에서도 WZ 프레임 애니메이션과 type 4 이동 배경은 계속 갱신된다.
