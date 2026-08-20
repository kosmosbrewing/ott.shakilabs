import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind.config.ts의 커스텀 fontSize(h1·h2·heading·body·caption·tiny)를
// twMerge에 알려준다. 기본 설정만 쓰면 `text-tiny`를 폰트 크기가 아니라 '색'으로
// 오분류해서, 같은 cn() 호출에 들어온 `text-savings-foreground` 같은 색 클래스를
// 뒤에 온 크기 클래스가 조용히 지워버린다.
// 배지의 `!text-white` 하드코딩이 바로 이 버그의 우회책이었고, 그 탓에 다크 절약
// 배지가 2.37:1이 됐다. 토큰이 정상 적용되도록 분류를 바로잡는 게 근본 수정이다.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["h1", "h2", "heading", "body", "caption", "tiny"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// 숫자 포맷: 1000 → "1,000"
export function formatNumber(num: number | null | undefined): string {
  if (num == null) return "-";
  return num.toLocaleString("ko-KR");
}

// 통화 포맷: (14900, "KRW") → "₩14,900"
export function formatCurrency(amount: number | null | undefined, currency: string): string {
  if (amount == null) return "-";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(amount);
}

// 절약률 계산: (3130, 14900) → 79.0  (소수점 1자리)
export function calcSavingsPercent(
  price: number | null | undefined,
  basePrice: number | null | undefined
): number {
  if (!price || !basePrice || basePrice === 0) return 0;
  return Math.round(((basePrice - price) / basePrice) * 1000) / 10;
}

// 국가 코드 → 국기 이모지: "KR" → 🇰🇷
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}
