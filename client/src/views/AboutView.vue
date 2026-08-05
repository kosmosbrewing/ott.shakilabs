<script setup lang="ts">
import { useSEO } from "@/composables/useSEO";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

useSEO({
  title: "서비스 소개 | OTT 가격 비교",
  description: "넷플릭스·유튜브 프리미엄 등 OTT 서비스의 국가별 구독료를 실시간 환율 기준으로 비교하는 서비스입니다. 데이터 출처와 갱신 주기를 안내합니다.",
});
</script>

<template>
  <div class="container py-8">
    <section class="retro-panel overflow-hidden mb-6">
      <div class="retro-titlebar">
        <h1 class="retro-title">서비스 소개</h1>
        <span class="retro-kbd">ABOUT</span>
      </div>
      <div class="retro-panel-content">
        <p class="text-body text-muted-foreground">
          OTT 서비스 국가별 구독료를 실시간 환율 기준으로 비교합니다.
        </p>
      </div>
    </section>

    <Card class="mb-6 retro-panel">
      <CardHeader>
        <CardTitle>제공 기능</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-1">
          <li>넷플릭스·유튜브 프리미엄 등 주요 OTT 국가별 가격 비교</li>
          <li>실시간 환율 기준 KRW / USD 자동 환산</li>
          <li>개인·패밀리·학생 요금제 플랜별 비교</li>
          <li>국가 간 요금 1:1 직접 비교</li>
          <li>국가별 가격 변동 트렌드</li>
          <li>익명 커뮤니티 (구독 후기·요금제 선택 팁 공유)</li>
        </ul>
      </CardContent>
    </Card>

    <Card class="mb-6 retro-panel">
      <CardHeader>
        <CardTitle>데이터 출처와 검증 방법</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-body text-muted-foreground mb-2">
          모든 가격 데이터는
          <a
            href="https://www.youtube.com/premium"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >YouTube Premium 공식 페이지</a>
          등 각국 공식 요금 페이지와 직접 대조해 검증한 뒤 게재하며, 정기적으로 재검증·갱신합니다.
        </p>
        <p class="text-body text-muted-foreground">
          요금제·결제 관련 공식 안내는
          <a
            href="https://support.google.com/youtube"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >YouTube 고객센터</a>
          에서 확인할 수 있습니다.
        </p>
      </CardContent>
    </Card>

    <Card class="mb-6 retro-panel">
      <CardHeader>
        <CardTitle>면책 조항</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-1">
          <li>가격은 예고 없이 변동될 수 있으므로 결제 전 공식 사이트에서 확인하세요.</li>
          <li>환율 기준 원화 환산가는 실제 청구 금액과 다를 수 있습니다.</li>
          <li>해외 결제 이용 시 각 서비스의 이용약관을 반드시 검토하세요.</li>
        </ul>
      </CardContent>
    </Card>

    <Card class="retro-panel">
      <CardHeader>
        <CardTitle>운영자 정보 · 문의</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-body font-semibold mb-2">
          운영: ShakiLabs · 문의:
          <a href="mailto:skdba1313@gmail.com" class="hover:underline">skdba1313@gmail.com</a>
        </p>
        <p class="text-body text-muted-foreground">
          잘못된 가격 정보 제보 및 기타 문의를 이메일로 받고 있습니다.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
