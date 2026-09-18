import Link from 'next/link';

export default function PageNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
      <p className="text-lg font-medium">페이지를 찾을 수 없습니다</p>
      <p className="text-sm text-zinc-500">삭제(보관)되었거나 주소가 잘못되었습니다.</p>
      <Link href="/" className="text-sm text-blue-600 underline">
        홈으로
      </Link>
    </div>
  );
}
