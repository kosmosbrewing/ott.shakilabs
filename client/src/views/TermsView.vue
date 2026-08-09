<script setup lang="ts">
import { RouterLink } from "vue-router";
import { useSEO } from "@/composables/useSEO";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

useSEO({
  title: "이용약관 | OTT 가격 비교",
  description: "OTT Watcher 서비스 이용약관입니다. 서비스 이용 조건, 데이터 정확성, 광고 안내 등을 확인하세요.",
});
</script>

<template>
  <div class="container py-8 space-y-6">
    <section class="retro-panel overflow-hidden">
      <div class="retro-titlebar">
        <h1 class="retro-title">이용약관</h1>
        <span class="retro-kbd">TERMS</span>
      </div>
      <div class="retro-panel-content">
        <p class="text-body text-muted-foreground">
          본 약관은 OTT Watcher(이하 "서비스")가 제공하는 OTT 구독료 국가별 가격 비교 서비스 이용에 관한 조건을 규정합니다.
          서비스를 이용함으로써 본 약관에 동의한 것으로 간주합니다.
        </p>
        <p class="text-tiny text-muted-foreground mt-2">최종 업데이트: 2026년 2월 22일</p>
      </div>
    </section>

    <Card class="retro-panel">
      <CardHeader><CardTitle>제1조 서비스 목적 및 범위</CardTitle></CardHeader>
      <CardContent>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-1">
          <li>서비스는 YouTube Premium 등 OTT 플랫폼의 국가별 공식 구독료를 정보 제공 목적으로 수집·제공합니다.</li>
          <li>모든 가격 정보는 각 서비스의 공식 공개 요금을 기준으로 하며, 참고 자료로만 활용하시기 바랍니다.</li>
          <li>서비스는 각 OTT 플랫폼과 제휴 관계가 없으며, 특정 결제 방법을 권장하지 않습니다.</li>
        </ul>
      </CardContent>
    </Card>

    <Card class="retro-panel">
      <CardHeader><CardTitle>제2조 데이터 정확성 면책</CardTitle></CardHeader>
      <CardContent>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-1">
          <li>가격 및 환율 데이터는 정기적으로 갱신되나, 실제 청구 금액과 차이가 발생할 수 있습니다.</li>
          <li>원화 환산가는 기준일 환율 기반 추정치이며, 카드사 해외 결제 수수료 등에 따라 실제 금액이 달라질 수 있습니다.</li>
          <li>결제 전 반드시 해당 서비스 공식 사이트에서 최신 요금을 확인하시기 바랍니다.</li>
          <li>서비스는 가격 정보의 정확성을 보증하지 않으며, 이로 인한 손해에 대해 책임지지 않습니다.</li>
        </ul>
      </CardContent>
    </Card>

    <Card class="retro-panel">
      <CardHeader><CardTitle>제3조 이용자 의무 및 제한</CardTitle></CardHeader>
      <CardContent>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-1">
          <li>이용자는 각 OTT 서비스의 이용약관 및 관련 법령을 준수하여야 합니다.</li>
          <li>서비스 내 커뮤니티에 불법적이거나 타인의 권리를 침해하는 내용을 게시해서는 안 됩니다.</li>
          <li>서비스의 데이터 및 콘텐츠를 무단으로 크롤링·복제·재배포하는 행위를 금지합니다.</li>
          <li>서비스 운영을 방해하거나 시스템에 과부하를 주는 행위를 금지합니다.</li>
        </ul>
      </CardContent>
    </Card>

    <Card class="retro-panel">
      <CardHeader><CardTitle>제4조 저작권 및 지식재산권</CardTitle></CardHeader>
      <CardContent>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-1">
          <li>서비스의 화면 디자인, 로고, 소프트웨어 등 일체의 지식재산권은 운영자에게 귀속됩니다.</li>
          <li>각 OTT 서비스명 및 상표는 해당 회사의 등록 상표입니다. 본 서비스는 해당 기업과 제휴 관계가 없습니다.</li>
          <li>가격 데이터는 공개 정보를 수집·가공한 것으로, 원본 데이터의 저작권은 각 서비스 제공자에게 있습니다.</li>
        </ul>
      </CardContent>
    </Card>

    <Card class="retro-panel">
      <CardHeader><CardTitle>제5조 광고</CardTitle></CardHeader>
      <CardContent>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-1">
          <li>본 서비스는 Google AdSense 등의 광고 프로그램을 통해 광고를 게재할 수 있습니다.</li>
          <li>Google을 포함한 제3자 광고 사업자는 광고 쿠키를 사용하여 이용자의 방문 기록 기반 맞춤 광고를 게재할 수 있습니다.</li>
          <li>
            맞춤 광고는
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
            >Google 광고 설정</a>
            또는
            <a
              href="https://www.aboutads.info/choices"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
            >www.aboutads.info/choices</a>
            에서 거부할 수 있습니다.
          </li>
          <li>광고 콘텐츠는 광고주가 제공하며, 서비스는 광고 내용에 대해 책임을 지지 않습니다.</li>
          <!-- RouterLink라야 라우터 base(/ott/)가 붙는다. 평문 href="/privacy"는 도메인 루트로 나간다 -->
          <li>광고 쿠키 사용에 관한 자세한 내용은 <RouterLink to="/privacy" class="text-primary hover:underline">개인정보처리방침</RouterLink>을 참고하세요.</li>
        </ul>
      </CardContent>
    </Card>

    <Card class="retro-panel">
      <CardHeader><CardTitle>제6조 서비스 변경 및 중단</CardTitle></CardHeader>
      <CardContent>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-1">
          <li>서비스는 연중무휴 제공을 원칙으로 하나, 데이터 갱신·설비 점검·장애 복구가 필요한 경우 일시 중단될 수 있습니다.</li>
          <li>긴급한 사유가 아니라면 중단 사실과 사유를 사전에 공지합니다.</li>
          <li>가격 데이터의 갱신 주기는 각 사업자의 공지 확인 시점에 따라 달라질 수 있습니다.</li>
          <li>본 약관은 변경 시 서비스 내 공지를 통해 안내하며, 변경 후 계속 이용 시 변경 내용에 동의한 것으로 간주합니다.</li>
        </ul>
      </CardContent>
    </Card>

    <Card class="retro-panel">
      <CardHeader><CardTitle>제7조 외부 링크</CardTitle></CardHeader>
      <CardContent>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-1">
          <li>서비스는 각 OTT 사업자의 공식 페이지 등 외부 사이트로 연결되는 링크를 포함합니다.</li>
          <li>연결된 사이트의 콘텐츠와 정책은 해당 사이트 운영자의 책임이며, 서비스는 이에 대해 보증하지 않습니다.</li>
        </ul>
      </CardContent>
    </Card>

    <Card class="retro-panel">
      <CardHeader><CardTitle>제8조 준거법 및 분쟁 해결</CardTitle></CardHeader>
      <CardContent>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-1">
          <li>본 약관은 대한민국 법령에 따라 해석됩니다.</li>
          <li>서비스 이용과 관련해 분쟁이 발생한 경우 운영자와 이용자는 먼저 협의를 통한 해결을 시도합니다.</li>
          <li>협의가 이루어지지 않으면 민사소송법상 관할 법원에 소를 제기할 수 있습니다.</li>
        </ul>
      </CardContent>
    </Card>

    <Card class="retro-panel">
      <CardHeader><CardTitle>문의</CardTitle></CardHeader>
      <CardContent>
        <p class="text-body text-muted-foreground mb-2">약관에 관한 문의:</p>
        <a href="mailto:skdba1313@gmail.com" class="text-body font-semibold hover:underline">
          skdba1313@gmail.com
        </a>
      </CardContent>
    </Card>
  </div>
</template>
