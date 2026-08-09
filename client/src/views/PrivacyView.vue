<script setup lang="ts">
import { useSEO } from "@/composables/useSEO";

useSEO({
  title: "개인정보처리방침 | OTT 가격 비교",
  description: "OTT 가격 비교 서비스의 개인정보 처리 원칙을 안내합니다.",
});
</script>

<template>
  <div class="container py-8">
    <section class="retro-panel overflow-hidden mb-6">
      <div class="retro-titlebar">
        <h1 class="retro-title">개인정보처리방침</h1>
        <span class="retro-kbd">POLICY</span>
      </div>
      <div class="retro-panel-content">
        <p class="text-body text-muted-foreground">
          서비스 운영 과정에서의 개인정보 처리 원칙을 안내합니다.
        </p>
      </div>
    </section>

    <div class="retro-panel retro-panel-content space-y-6">
      <section>
        <h2 class="text-h2 mb-3">1. 수집하는 정보</h2>
        <p class="text-body leading-relaxed">
          본 사이트는 별도의 회원가입 없이 이용할 수 있으며, 직접적인 개인정보를 수집하지 않습니다.
          다만, 서비스 이용 과정에서 아래 정보가 자동으로 수집될 수 있습니다.
        </p>
        <ul class="list-disc list-inside text-body text-muted-foreground mt-2 space-y-1">
          <li>접속 IP 주소, 브라우저 종류, 접속 시간</li>
          <li>방문 페이지 및 이용 기록 (Google Analytics를 통해)</li>
          <li>익명 커뮤니티 글·댓글 작성 시: 작성 내용, 닉네임(자동 생성), IP 주소, User-Agent</li>
        </ul>
        <p class="text-body text-muted-foreground mt-2">
          커뮤니티에 수집된 IP 및 User-Agent는 어뷰징·스팸 방지 목적으로만 사용되며, 외부에 공개되지 않습니다.
        </p>
        <p class="text-body text-muted-foreground mt-2">
          본 서비스는 회원가입·뉴스레터·가격 알림 등 이메일 주소를 수집하는 기능을 운영하지 않으며,
          이용자가 문의 목적으로 직접 발송한 이메일 외에 이메일 주소를 수집·보관하지 않습니다.
          테마 등 화면 설정 값은 이용자의 브라우저(localStorage)에만 저장되며 서버로 전송되지 않습니다.
        </p>
      </section>

      <section>
        <h2 class="text-h2 mb-3">2. 이용하는 제3자 서비스</h2>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-2">
          <li>
            Google Analytics 4: 방문 통계 분석을 위해 익명화된 이용 정보를 수집합니다.
            수집 거부는
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              class="underline"
            >Google Analytics Opt-out Add-on</a>
            에서 설정할 수 있습니다.
          </li>
          <li>
            Google AdSense: Google을 포함한 제3자 광고 사업자는 광고 쿠키를 사용하여
            이용자의 본 사이트 및 다른 웹사이트 방문 기록을 기반으로 맞춤 광고를 게재할 수 있습니다.
            맞춤 광고(개인 맞춤 광고)는
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              class="underline"
            >Google 광고 설정</a>
            또는
            <a
              href="https://www.aboutads.info/choices"
              target="_blank"
              rel="noopener noreferrer"
              class="underline"
            >www.aboutads.info/choices</a>
            에서 언제든지 사용 중지(opt-out)할 수 있습니다.
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-h2 mb-3">3. 쿠키 사용</h2>
        <p class="text-body leading-relaxed">
          본 사이트는 통계 분석 및 광고 제공을 위해 쿠키를 사용할 수 있습니다.
          브라우저 설정에서 쿠키 저장을 거부하거나 삭제할 수 있으나, 일부 기능이 제한될 수 있습니다.
        </p>
      </section>

      <section>
        <h2 class="text-h2 mb-3">4. 개인정보의 보관 및 파기</h2>
        <p class="text-body leading-relaxed">
          수집된 정보는 서비스 운영 및 어뷰징 방지 목적으로만 사용되며,
          수집 목적 달성 후 또는 관련 법령에 따라 지체 없이 파기합니다.
          방문 로그는 Google Analytics 정책에 따라 기본 26개월, 서버 액세스 로그는 최대 6개월 보관 후 자동 파기됩니다.
          익명 커뮤니티 글·댓글에 부수적으로 기록되는 IP와 User-Agent는 해당 글이 삭제되면 함께 삭제됩니다.
        </p>
      </section>

      <section>
        <h2 class="text-h2 mb-3">5. 이용자 권리</h2>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-2">
          <li>개인정보 열람, 정정, 삭제를 이메일로 요청할 수 있습니다.</li>
          <li>
            Google Analytics 수집 거부:
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              class="underline"
            >브라우저 Add-on</a>
          </li>
          <li>
            광고 맞춤화 거부:
            <a
              href="https://adssettings.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              class="underline"
            >Google 광고 설정</a>
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-h2 mb-3">6. 국외 이전</h2>
        <p class="text-body leading-relaxed">
          본 서비스는 Google Analytics와 Google AdSense를 이용하므로, 자동 수집되는 접속 기록·쿠키 식별자 등
          비식별 이용 정보가 Google LLC가 운영하는 국외 서버에서 처리될 수 있습니다.
          이전 목적은 통계 분석과 광고 게재이며, 이용자는 쿠키 차단 또는 위 opt-out 수단으로 해당 처리를 거부할 수 있습니다.
        </p>
      </section>

      <section>
        <h2 class="text-h2 mb-3">7. 만 14세 미만 아동</h2>
        <p class="text-body leading-relaxed">
          본 서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를 알면서 수집하지 않습니다.
          아동의 정보가 수집된 사실을 확인한 경우 지체 없이 파기합니다.
        </p>
      </section>

      <section>
        <h2 class="text-h2 mb-3">8. 안전성 확보 조치</h2>
        <ul class="list-disc list-inside text-body text-muted-foreground space-y-1">
          <li>전 구간 HTTPS 암호화 전송</li>
          <li>화면 설정 값의 브라우저 내 처리(서버 미전송)로 수집 자체를 최소화</li>
          <li>관리자 접근 권한 최소화 및 접근 기록 보관</li>
        </ul>
      </section>

      <section>
        <h2 class="text-h2 mb-3">9. 권리 구제</h2>
        <p class="text-body leading-relaxed">
          개인정보 침해에 관한 상담이 필요하면 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118)
          또는 개인정보 분쟁조정위원회(kopico.go.kr)에 문의할 수 있습니다.
        </p>
      </section>

      <section>
        <h2 class="text-h2 mb-3">10. 개인정보 보호책임자 및 문의</h2>
        <p class="text-body leading-relaxed">운영: ShakiLabs</p>
        <p class="text-body leading-relaxed">
          이메일:
          <a href="mailto:skdba1313@gmail.com" class="underline">skdba1313@gmail.com</a>
        </p>
      </section>

      <p class="text-caption text-muted-foreground mt-8">
        시행일: 2026년 2월 21일
      </p>
    </div>
  </div>
</template>
