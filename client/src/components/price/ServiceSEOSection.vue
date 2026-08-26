<script setup lang="ts">
import { computed } from "vue";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

type FaqItem = { q: string; a: string };

const props = defineProps<{
  serviceSlug: string;
  serviceName: string;
  selectedPlanLabel: string;
  cheapestCountry: string | null;
  cheapestKrw: number | null;
  cheapestUsd: number | null;
  baseCountryName: string;
  baseKrw: number | null;
  baseUsd: number | null;
  savingsPercent: number;
  exchangeRateDate: string;
  lastUpdated: string;
  baseCountryCode: string;
}>();

function fmtKrw(val: number | null | undefined): string {
  if (val == null) return "-";
  return `${Math.round(val).toLocaleString("ko-KR")}원`;
}

function fmtUsd(val: number | null | undefined): string {
  if (val == null) return "-";
  return `$${val.toFixed(2)}`;
}

const faqItems = computed<FaqItem[]>(() => {
  if (!props.cheapestCountry || !props.serviceName) return [];

  const isYoutubePremium = props.serviceSlug === "youtube-premium";
  const isKoreaBase = props.baseCountryCode === "KR";

  const cheapestUsdStr = props.cheapestUsd != null ? ` / ${fmtUsd(props.cheapestUsd)}` : "";
  const baseUsdStr = props.baseUsd != null ? ` / ${fmtUsd(props.baseUsd)}` : "";

  const cheapestAnswer =
    props.baseKrw && props.savingsPercent > 0
      ? `현재 환율(기준일: ${props.exchangeRateDate})을 반영한 결과, ${props.cheapestCountry} ${props.selectedPlanLabel} 요금이 월 ${fmtKrw(props.cheapestKrw)}${cheapestUsdStr}으로 가장 낮습니다.\n이는 ${props.baseCountryName}(${fmtKrw(props.baseKrw)}${baseUsdStr}) 대비 약 ${props.savingsPercent}% 낮은 수준입니다.`
      : `현재 환율(기준일: ${props.exchangeRateDate})을 반영한 결과, ${props.cheapestCountry} ${props.selectedPlanLabel} 요금이 월 ${fmtKrw(props.cheapestKrw)}${cheapestUsdStr}으로 가장 낮습니다.`;

  const baseAnswer = props.baseKrw
    ? `${props.baseCountryName} ${props.serviceName} ${props.selectedPlanLabel} 요금은 월 ${fmtKrw(props.baseKrw)}${baseUsdStr}입니다.${isYoutubePremium && isKoreaBase ? "\niOS 앱스토어 결제 시 금액이 다를 수 있습니다." : ""}`
    : `${props.serviceName} ${props.selectedPlanLabel} 요금은 서비스 공식 안내 페이지에서 확인할 수 있습니다.`;

  const commonFaqItems: FaqItem[] = [
    { q: `${props.serviceName} ${props.selectedPlanLabel} 요금제 기준 가장 저렴한 나라는?`, a: cheapestAnswer },
    {
      q: isYoutubePremium && isKoreaBase
        ? "한국 YouTube Premium 요금은 얼마인가요?"
        : isKoreaBase
        ? `한국 ${props.serviceName} ${props.selectedPlanLabel} 요금제는?`
        : `${props.baseCountryName} ${props.serviceName} ${props.selectedPlanLabel} 요금제는?`,
      a: baseAnswer,
    },
    { q: "국가마다 가격이 다른 이유가 뭔가요?", a: "플랫폼 사업자는 국가별 세금 정책, 현지 구매력, 결제 인프라, 모바일 시장 경쟁 환경, 프로모션 전략 등을 종합적으로 반영해 지역별 가격을 책정합니다.\n따라서 동일 서비스라도 국가별 요금 차이가 발생합니다." },
    // "업데이트 주기"는 존재하지 않는 갱신 스케줄을 주장한다. 실제로 있는 것은 기준일뿐이다.
    { q: "환율이 바뀌면 원화 가격도 달라지나요?", a: `네, 달라집니다. 현지 통화 요금이 같아도 원화 환산값은 변동됩니다.\n이 페이지의 원화 값은 환율 기준일(${props.exchangeRateDate})의 환율로 계산돼 있어, 지금 보고 계신 시점의 환율과는 차이가 날 수 있습니다.\n실제 결제 시점의 환율 및 카드사 해외 결제 수수료에 따라 최종 청구 금액은 달라질 수 있습니다.` },
    // 프리렌더 FAQ는 마운트 시 제거되므로 크롤러와 사용자가 서로 다른 FAQ를 본다.
    // 한국에 가족 요금제가 없다는 사실은 양쪽 모두에 있어야 한다 — 프리렌더에만 두면
    // 정작 화면을 보는 사람은 그 사실을 못 본다.
    {
      q: isYoutubePremium && isKoreaBase
        ? "한국에서도 가족 요금제로 나눠 낼 수 있나요?"
        : "패밀리 플랜이 개인 플랜보다 유리한가요?",
      a: isYoutubePremium && isKoreaBase
        ? "아니오. 대한민국에서는 YouTube Premium 가족 요금제를 이용할 수 없습니다.\nYouTube 고객센터는 가족 요금제 미제공 국가로 대한민국·베네수엘라·벨라루스·슬로베니아·아이슬란드를 명시합니다. 한국 청구 국가 계정으로는 가입도 공유도 불가능합니다.\n가족 요금제가 제공되는 국가에서는 관리자가 같은 거주지 주소에 사는 가족 구성원을 최대 5명까지 초대할 수 있습니다."
        : "비용 측면에서는 인원 수가 많을수록 1인당 부담이 낮아질 수 있습니다.\n다만 동일 거주지(Same Household) 요건, 국가 제한, 계정 공유 정책을 충족해야 합니다.\n최근 접속 위치/IP 기반 검증에 따라 이용이 제한될 수 있으므로 약관 확인이 필요합니다.",
    },
    // llms.txt·프리렌더 FAQ와 같은 사실을 말해야 한다: 정가는 수동 조사, 환율만 API.
    // "내부 모니터링"·"정기 반영"은 상시 감시와 정기 스케줄을 주장하는데 둘 다 존재하지 않는다.
    { q: "가격 데이터는 어떻게 수집하고 업데이트하나요?", a: `현지 통화 정가는 자동 수집 수단이 없어, 서비스 공식 요금 안내를 사람이 확인해 반영합니다. 그래서 상시 최신을 보장하지 않으며 실제로 조사한 날짜를 요금 조사일로 표기합니다.\n현재 요금 조사일은 ${props.lastUpdated}, 환율 기준일은 ${props.exchangeRateDate}입니다.\n원화 환산에 쓰는 환율만 공개 환율 API에서 가져옵니다. 실시간·일 단위 가격 시계열은 제공하지 않습니다.` },
  ];

  const serviceSpecificFaqMap: Record<string, FaqItem[]> = {
    "youtube-premium": [
      { q: "해외 저가 요금제 이용 시 유의사항은?", a: "국가별로 현지 발급 결제수단을 요구하는 경우가 많습니다.\n각 서비스의 이용약관 및 국가별 접속 정책에 따라 이용 제한이 발생할 수 있으므로, 결제 전 해당 서비스의 공식 이용 조건을 반드시 확인하시기 바랍니다." },
      { q: "프리미엄 라이트(Lite)나 듀오(Duo) 요금제는 왜 일부 국가에만 있나요?", a: "신규 요금제는 서비스사의 지역별 테스트, 규제 환경, 상용화 일정에 따라 순차적으로 도입됩니다.\n해당 국가에서 공식 지원하지 않는 플랜은 비교표에서 제외되며, 정책 변경 시 제공 여부가 달라질 수 있습니다." },
    ],
    spotify: [
      { q: "Spotify Duo/Family/Student 비교 시 무엇을 확인해야 하나요?", a: "요금뿐 아니라 자격 요건을 함께 확인해야 합니다.\n동일 주소 확인, 학생 인증, 국가 제한 등 플랜별 조건이 달라 실제 가입 가능 여부가 다를 수 있습니다." },
    ],
    netflix: [
      { q: "Netflix 요금제 명칭이 국가마다 다른 이유는 무엇인가요?", a: "광고형 포함 여부, 화질, 동시 시청 수 등 요금제 구성 요소가 국가별로 다를 수 있기 때문입니다.\n동일 명칭이라도 제공 기능은 국가 정책에 따라 달라질 수 있습니다." },
    ],
    "disney-plus": [
      { q: "Disney+ 연간 요금(월 환산)과 월간 요금은 어떻게 봐야 하나요?", a: "연간 요금의 월 환산값은 비교를 위한 참고값입니다.\n실제 결제는 선결제 조건, 환불 정책, 국가별 약관에 따라 다를 수 있으므로 결제 조건을 함께 확인해야 합니다." },
    ],
    "amazon-prime-video": [
      { q: "Amazon Prime Video 요금 비교 시 유의할 점은?", a: "국가에 따라 Prime 번들 포함 범위, 부가 혜택, 결제 주기가 다를 수 있습니다.\n단순 월 요금뿐 아니라 실제 제공 범위를 함께 확인하는 것이 안전합니다." },
    ],
  };

  return [...commonFaqItems, ...(serviceSpecificFaqMap[props.serviceSlug] || [])];
});

defineExpose({ faqItems });
</script>

<template>
  <Card v-if="faqItems.length" id="faq" class="mt-4 retro-panel overflow-hidden">
    <div class="retro-titlebar">
      <h2 class="retro-title">자주 묻는 질문</h2>
    </div>
    <CardContent class="px-4 py-2">
      <Accordion type="multiple" class="w-full">
        <AccordionItem
          v-for="(item, i) in faqItems"
          :key="i"
          :value="`faq-${i}`"
        >
          <article>
            <AccordionTrigger class="text-caption">{{ item.q }}</AccordionTrigger>
            <AccordionContent>{{ item.a }}</AccordionContent>
          </article>
        </AccordionItem>
      </Accordion>
    </CardContent>
  </Card>
</template>
