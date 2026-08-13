import Link from "next/link";

export function Attribution({ className = "" }: { className?: string }) {
  return (
    <footer className={`attribution ${className}`.trim()}>
      <span>Data based on NEXON Open API</span>
      <Link href="/privacy">개인정보 처리 안내</Link>
    </footer>
  );
}
