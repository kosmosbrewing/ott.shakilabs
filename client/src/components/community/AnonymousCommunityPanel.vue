<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { fetchCommunityPosts, fetchPopularPosts, submitCommunityPost, type CommunityPost } from "@/api";
import { LoadingSpinner } from "@/components/ui/loading";

const props = defineProps<{
  serviceSlug: string;
}>();

const COMMUNITY_SERVICE_SLUG =
  import.meta.env.VITE_COMMUNITY_SERVICE_SLUG || "global-community";

type TabType = "latest" | "popular";
const activeTab = ref<TabType>("latest");

const latestPosts = ref<CommunityPost[]>([]);
const popularPosts = ref<CommunityPost[]>([]);
const latestLoading = ref(false);
const popularLoading = ref(false);
const error = ref("");

const displayedPosts = computed(() =>
  activeTab.value === "popular" ? popularPosts.value : latestPosts.value
);
const loading = computed(() =>
  activeTab.value === "popular" ? popularLoading.value : latestLoading.value
);

function formatTime(iso: string | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function toPreviewTitle(post: CommunityPost): string {
  const t = (post.title || "").trim();
  if (t) return t;
  const firstLine = (post.content || "").split("\n").map((l) => l.trim()).find(Boolean);
  return firstLine || "제목 없음";
}

async function loadLatest(): Promise<void> {
  latestLoading.value = true;
  error.value = "";
  try {
    const res = await fetchCommunityPosts(COMMUNITY_SERVICE_SLUG, "ALL", 10);
    latestPosts.value = Array.isArray(res.posts) ? res.posts.slice(0, 10) : [];
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : "불러오지 못했습니다.";
  } finally {
    latestLoading.value = false;
  }
}

async function loadPopular(): Promise<void> {
  popularLoading.value = true;
  try {
    const res = await fetchPopularPosts(COMMUNITY_SERVICE_SLUG, 10);
    popularPosts.value = Array.isArray(res.posts) ? res.posts : [];
  } catch {
    popularPosts.value = [];
  } finally {
    popularLoading.value = false;
  }
}

async function switchTab(tab: TabType): Promise<void> {
  activeTab.value = tab;
  if (tab === "popular" && popularPosts.value.length === 0) {
    try {
      await loadPopular();
    } catch {
      // loadPopular 내부의 popularPosts error 처리
    }
  }
}

const MAX_LENGTH = 300;
const postContent = ref("");
const postSubmitting = ref(false);
const postError = ref("");

const contentLength = computed(() => postContent.value.length);

async function submitPost(): Promise<void> {
  const content = postContent.value.trim();
  if (!content || postSubmitting.value) return;
  postSubmitting.value = true;
  postError.value = "";
  try {
    await submitCommunityPost({
      serviceSlug: COMMUNITY_SERVICE_SLUG,
      countryCode: "ALL",
      content,
    });
    postContent.value = "";
    await loadLatest();
    activeTab.value = "latest";
  } catch (e: unknown) {
    postError.value = e instanceof Error ? e.message : "등록에 실패했습니다.";
  } finally {
    postSubmitting.value = false;
  }
}

watch(
  () => props.serviceSlug,
  async () => {
    try {
      await loadLatest();
    } catch {
      // loadLatest 내부의 error ref로 처리됨
    }
  },
  { immediate: true }
);
</script>

<template>
  <aside class="retro-panel overflow-hidden lg:sticky lg:top-20 lg:self-start">
    <!-- 탭 -->
    <div class="flex px-5 pt-2">
      <button
        class="flex-1 py-1.5 text-center !text-xs font-semibold transition-colors"
        :class="activeTab === 'latest' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'"
        @click="switchTab('latest')"
      >
        최신글
      </button>
      <button
        class="flex-1 py-1.5 text-center !text-xs font-semibold transition-colors"
        :class="activeTab === 'popular' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'"
        @click="switchTab('popular')"
      >
        인기글
      </button>
    </div>

    <!-- 목록 -->
    <div class="relative">
      <!-- 초기 로딩 (글이 아직 없을 때) -->
      <LoadingSpinner v-if="loading && displayedPosts.length === 0 && !error" class="py-10" variant="dots" size="sm" />

      <p v-else-if="error" class="retro-panel-content !text-xs text-destructive">{{ error }}</p>

      <ul v-else-if="displayedPosts.length > 0" class="mt-3 mb-3 transition-opacity duration-150" :class="loading ? 'opacity-40 pointer-events-none' : ''">
        <li v-for="(post, index) in displayedPosts" :key="post.id">
          <div v-if="index > 0" class="mx-5 border-t border-border/60" />
          <RouterLink
            :to="`/community/${post.id}`"
            class="block px-5 py-1 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <!-- 닉네임 · 날짜 -->
            <div class="flex items-center gap-1 !text-[11px] text-muted-foreground">
              <span class="font-semibold text-foreground">{{ post.nickname || "익명 유저" }}</span>
              <span>·</span>
              <span>{{ formatTime(post.createdAt) }}</span>
            </div>
            <!-- 본문 + 추천·댓글 -->
            <div class="mt-0.5 flex items-baseline justify-between gap-2">
              <p class="flex-1 !text-xs text-foreground line-clamp-1">
                {{ toPreviewTitle(post) }}
              </p>
              <span class="shrink-0 flex items-center gap-2 !text-[10px] text-muted-foreground tabular-nums">
                <span>추천 {{ post.likeCount ?? 0 }}</span>
                <span>답글 {{ post.commentCount ?? 0 }}</span>
              </span>
            </div>
          </RouterLink>
        </li>
      </ul>

      <p v-else class="retro-panel-content !text-xs text-muted-foreground">
        {{ activeTab === 'popular' ? '아직 인기글이 없습니다.' : '아직 등록된 글이 없습니다.' }}
      </p>
    </div>

    <!-- 글쓰기 -->
    <div class="border-t border-border/60 px-4 pt-3 pb-3">
      <p class="!text-[11px] font-semibold text-muted-foreground mb-1.5">익명 글쓰기</p>
      <div class="border border-border rounded">
        <textarea
          aria-label="익명 글 내용"
          v-model="postContent"
          :maxlength="MAX_LENGTH"
          rows="3"
          placeholder="가격 체감, 요금제 후기, 변경 제보 등을 익명으로 남겨주세요."
          class="w-full resize-none bg-transparent px-2.5 py-2 !text-xs outline-none placeholder:text-muted-foreground/60"
        />
        <div class="flex items-center justify-between border-t border-border/60 px-2.5 py-1.5">
          <span class="!text-[11px] text-muted-foreground tabular-nums">{{ contentLength }}/{{ MAX_LENGTH }}</span>
          <button
            type="button"
            :disabled="contentLength === 0 || postSubmitting"
            class="!text-[11px] font-semibold text-primary disabled:opacity-40 hover:underline"
            @click="submitPost"
          >
            {{ postSubmitting ? '등록 중...' : '등록' }}
          </button>
        </div>
      </div>
      <p v-if="postError" class="!text-[11px] text-destructive mt-1">{{ postError }}</p>
    </div>

    <!-- 전체보기 -->
    <div class="border-t border-border/60 px-5 py-3">
      <RouterLink
        to="/community"
        class="!text-xs font-semibold text-primary hover:underline"
      >
        전체보기 →
      </RouterLink>
    </div>
  </aside>
</template>
