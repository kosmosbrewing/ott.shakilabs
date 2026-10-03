import animate from "tailwindcss-animate";
import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  prefix: "",
  content: ["./index.html", "./src/**/*.{ts,vue}"],
  theme: {
    // 본문 폭은 Tailwind `container`(960px)가 아니라 패키지 `sh-container`(72rem·여백 clamp)가 정한다.
    // 960px로 두면 헤더(72rem)와 본문의 시작 x가 갈렸다(1280에서 124 vs 176). 정의는 커뮤니티 화면
    // (`container max-w-xl`)이 아직 쓰고 있어 남겨 둔다.
    container: {
      center: true,
      padding: "1rem",
      screens: {
        xl: "960px",
      },
    },
    extend: {
      // 본문 Pretendard + 제목/강조 보조 폰트
      fontFamily: {
        sans: [
          "Pretendard",
          "Noto Sans KR",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          ...fontFamily.sans,
        ],
        // 헤더 Fade / 네비 / 큰 제목 — GmarketSans 통일
        title: [
          "GmarketSans",
          "Pretendard",
          "Noto Sans KR",
          ...fontFamily.sans,
        ],
        emphasis: [
          "GmarketSans",
          "Pretendard",
          "Noto Sans KR",
          ...fontFamily.sans,
        ],
      },

      // 5단계 폰트 계층 (샤키샤키 동일)
      fontSize: {
        // 전 앱 공통 결과 히어로 금액 스케일 (26px/700) — 결과 히어로 문법 수렴 1단계
        display: ["1.625rem", { lineHeight: "1.2", fontWeight: "700" }],
        // 도구 페이지 H1 = 함대 기준 20px/700(GmarketSans는 font-title로 붙인다). 24px로 두면
        // 다른 앱의 같은 자리 제목보다 한 단계 커진다.
        h1: ["1.25rem", { lineHeight: "1.3", fontWeight: "700" }],
        h2: ["1.25rem", { lineHeight: "1.35", fontWeight: "600" }],
        heading: ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["0.9rem", { lineHeight: "1.6", fontWeight: "400" }],
        // 보조 글자 하한은 13px이다. 예전 값(12.5·10.5px)은 15px 루트에서도 11.7·9.8px였다.
        // tiny는 caption과 크기가 같고 줄간격만 좁다 — 13px 밑으로 내려갈 단계를 두지 않는다.
        caption: ["0.8125rem", { lineHeight: "1.5", fontWeight: "400" }],
        tiny: ["0.8125rem", { lineHeight: "1.2", fontWeight: "400" }],
      },

      // OTT 비교 사이트 전용 색상 (CSS 변수 기반)
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        savings: {
          DEFAULT: "hsl(var(--savings))",
          foreground: "hsl(var(--savings-foreground))",
        },
      },

      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "collapsible-down": {
          from: { height: 0 },
          to: { height: "var(--radix-collapsible-content-height)" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "collapsible-down": "collapsible-down 0.2s ease-in-out",
        "collapsible-up": "collapsible-up 0.2s ease-in-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
