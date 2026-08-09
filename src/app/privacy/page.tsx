import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <article>
        <p className="eyebrow">MAPLE HATCH PET</p>
        <h1>개인정보 처리 안내</h1>
        <p>
          이 서비스는 로그인 없이 입력한 닉네임으로 NEXON Open API의 캐릭터
          이름, 월드, 직업, 레벨과 현재 외형을 조회합니다. 캐릭터 소유권을
          확인하거나 보증하지 않습니다.
        </p>
        <h2>처리와 보관</h2>
        <p>
          조회 데이터는 요청 사이에 캐시하지 않습니다. Pet 만들기 요청에서는
          Vercel Function이 NEXON에서 현재 정보를 다시 조회하고 공식 캐릭터
          이미지만으로 PNG를 생성합니다.
        </p>
        <p>
          생성 PNG는 Vercel Blob 공개 저장소에 저장되며 URL을 아는 누구나 접근할
          수 있습니다. 생성 시각부터 <strong>28일간 유효</strong>하고, 매일
          실행되는 정리 작업으로
          <strong> 최대 30일 이내</strong> 삭제됩니다.
        </p>
        <h2>요청과 문의</h2>
        <p>
          접근·정정·삭제 요청은{" "}
          <a href="mailto:1000jjj@naver.com">1000jjj@naver.com</a>으로 보내
          주세요. 생성 이미지의 조기 삭제를 요청할 때는 생성 URL을 이메일 본문에
          포함해야 합니다.
        </p>
        <h2>NEXON 데이터 안내</h2>
        <p>
          NEXON Open API 데이터는 현 상태로 제공됩니다. 이 서비스는 NEXON의
          보증이나 제휴를 의미하지 않습니다.
        </p>
        <Link className="back-link" href="/">
          Maple Hatch Pet으로 돌아가기
        </Link>
      </article>
    </main>
  );
}
