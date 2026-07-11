import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { trackPageView } from "@/lib/analytics";
import servicesSeed from "../../../data/services.json";

const activeServiceSlugPattern = servicesSeed.services
  .filter((service) => service.active)
  .map((service) => service.slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const serviceSlugRoute = activeServiceSlugPattern || "__no-active-service__";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: () => import("@/views/HomeView.vue"),
    meta: {
      title:
        "OTT 구독료 국가별 가격 비교 | 유튜브 프리미엄·넷플릭스 나라별 최저가",
    },
  },
  // 정적 라우트를 동적 라우트보다 먼저 배치
  {
    path: "/about",
    name: "About",
    component: () => import("@/views/AboutView.vue"),
    meta: { title: "소개 | OTT 가격 비교" },
  },
  {
    path: "/privacy",
    name: "Privacy",
    component: () => import("@/views/PrivacyView.vue"),
    meta: { title: "개인정보처리방침 | OTT 가격 비교" },
  },
  {
    path: "/terms",
    name: "Terms",
    component: () => import("@/views/TermsView.vue"),
    meta: { title: "이용약관 | OTT 가격 비교" },
  },
  {
    path: "/report",
    name: "ReportRedirect",
    redirect: "/youtube-premium",
  },
  {
    path: "/changelog",
    name: "ChangelogRedirect",
    redirect: "/youtube-premium",
  },
  {
    path: "/community",
    name: "CommunityList",
    component: () => import("@/views/CommunityListView.vue"),
    meta: { title: "커뮤니티 | OTT 가격 비교" },
  },
  {
    path: "/community/:postId",
    name: "CommunityPost",
    component: () => import("@/views/CommunityPostView.vue"),
    meta: { title: "댓글 보기" },
  },
  {
    path: `/:serviceSlug(${serviceSlugRoute})/trends`,
    name: "ServiceTrends",
    component: () => import("@/views/TrendsView.vue"),
    meta: { title: "유튜브 프리미엄 가격 변동 트렌드 · 국가별 구독료 변화" },
  },
  {
    path: `/:serviceSlug(${serviceSlugRoute})`,
    name: "ServicePrice",
    component: () => import("@/views/ServicePriceView.vue"),
    meta: { title: "유튜브 프리미엄 글로벌 가격 비교 · 나라별 구독료 최저가" },
  },
  {
    path: `/:serviceSlug(${serviceSlugRoute})/:countryCode([A-Za-z]{2})`,
    name: "CountryDetail",
    component: () => import("@/views/CountryDetailView.vue"),
    meta: { title: "국가별 가격 상세 | OTT 가격 비교" },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/views/NotFoundView.vue"),
    meta: { title: "페이지를 찾을 수 없습니다 | OTT 가격 비교" },
  },
];

const router = createRouter({
  history: createWebHistory('/ott/'),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (_to.hash) return { el: _to.hash, behavior: "smooth", top: 80 };
    return { top: 0 };
  },
});

// 페이지 타이틀 동적 변경
router.beforeEach((to, _from, next) => {
  const title = typeof to.meta.title === "string" ? to.meta.title : "OTT 가격 비교";
  document.title = title;
  next();
});

router.afterEach((to, _from, failure) => {
  if (failure) return;
  const title = typeof to.meta.title === "string" ? to.meta.title : document.title;
  trackPageView(to.fullPath, title);
});

export default router;
