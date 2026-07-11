<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { submitCommunityPost, fetchPopularPosts, type CommunityPost } from "@/api";
import { useCommunityList } from "@/composables/useCommunityList";
import { isPostLiked } from "@/composables/useLike";
import { useSEO } from "@/composables/useSEO";
import { LoadingSpinner } from "@/components/ui/loading";

const COMMUNITY_SERVICE_SLUG =
  import.meta.env.VITE_COMMUNITY_SERVICE_SLUG || "global-community";
const communityEnabled = import.meta.env.PROD || import.meta.env.VITE_ENABLE_COMMUNITY_API === "true";

const router = useRouter();
const { posts, loading, error, hasMore, refresh, loadMore } = useCommunityList(20);

type TabType = "latest" | "popular";
const activeTab = ref<TabType>("latest");
const popularPosts = ref<CommunityPost[]>([]);
const popularLoading = ref(false);

const title = ref("");
const content = ref("");
const submitting = ref(false);
const formError = ref("");

useSEO({
  title: computed(() => "커뮤니티 | OTT 가격 비교"),
  description: computed(() => "OTT 가격 정보 공유 커뮤니티"),
});

function formatTime(iso: string | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function toPreviewTitle(postTitle: string | undefined, contentText: string | undefined): string {
  const normalizedTitle = (postTitle || "").trim();
  if (normalizedTitle) return normalizedTitle;
  const firstLine = (contentText || "").split("\n").map((line) => line.trim()).find(Boolean);
  return firstLine || "제목 없음";
}

async function loadPopular(): Promise<void> {
  if (!communityEnabled) return;

  popularLoading.value = true;
  try {
    const res = await fetchPopularPosts(COMMUNITY_SERVICE_SLUG, 30);
    popularPosts.value = Array.isArray(res.posts) ? res.posts : [];
  } catch {
    popularPosts.value = [];
  } finally {
    popularLoading.value = false;
  }
}

function scrollToCompose(): void {
  document.getElementById("community-compose")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function switchTab(tab: TabType): void {
  activeTab.value = tab;
  if (tab === "popular" && popularPosts.value.length === 0) {
    void loadPopular();
  }
}

async function submitPost(): Promise<void> {
  if (!communityEnabled) return;

  formError.value = "";
  const normalizedTitle = title.value.trim();
  const normalizedContent = content.value.trim();

  if (normalizedTitle.length < 2 || normalizedTitle.length > 100) {
    formError.value = "제목은 2자 이상 100자 이하로 입력해 주세요.";
    return;
  }
  if (normalizedContent.length < 2 || normalizedContent.length > 2000) {
    formError.value = "본문은 2자 이상 2000자 이하로 입력해 주세요.";
    return;
  }

  submitting.value = true;
  try {
    const res = await submitCommunityPost({
      serviceSlug: COMMUNITY_SERVICE_SLUG,
      countryCode: "ALL",
      title: normalizedTitle,
      content: normalizedContent,
    });
    title.value = "";
    content.value = "";
    if (typeof res.id === "string" && res.id) {
      await router.push(`/community/${res.id}`);
    } else {
      await refresh();
      activeTab.value = "latest";
    }
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : "게시글 등록 중 오류가 발생했습니다.";
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  if (!communityEnabled) return;
  void refresh();
});
</script>

<template>
  <div class="container max-w-xl py-6 space-y-2">
    <!-- 탭 + 글쓰기 버튼 -->
    <div class="flex items-center justify-between px-1">
      <div class="flex gap-3">
        <button
          class="!text-xs font-semibold transition-colors pb-0.5"
          :class="activeTab === 'latest' ? 'text-foreground border-b border-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="switchTab('latest')"
        >
          최신글
        </button>
        <button
          class="!text-xs font-semibold transition-colors pb-0.5"
          :class="activeTab === 'popular' ? 'text-foreground border-b border-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="switchTab('popular')"
        >
          인기글
        </button>
      </div>
      <button
        v-if="communityEnabled"
        type="button"
        class="!text-xs font-semibold text-primary hover:underline"
        @click="scrollToCompose"
      >
        글쓰기 ↓
      </button>
    </div>

    <!-- 게시글 목록 -->
    <section class="retro-panel overflow-hidden">
      <p v-if="!communityEnabled" class="px-4 py-4 !text-sm text-muted-foreground">
        로컬 단독 실행에서는 커뮤니티를 불러오지 않습니다. 백엔드 연결 후 다시 확인해 주세요.
      </p>

      <!-- 최신글 -->
      <template v-else-if="activeTab === 'latest'">
        <LoadingSpinner v-if="loading && posts.length === 0" class="p-4" message="게시글을 불러오는 중..." />
        <div v-else-if="error" class="px-4 py-4 space-y-2">
          <p class="!text-sm text-destructive">{{ error }}</p>
          <button type="button" class="retro-button-subtle !px-2 !py-1 !text-xs" @click="refresh">다시 시도</button>
        </div>
        <ul v-else-if="posts.length > 0" class="divide-y divide-border/60">
          <li v-for="post in posts" :key="post.id">
            <RouterLink
              :to="`/community/${post.id}`"
              class="block px-4 py-3 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div class="flex items-center gap-1.5 !text-xs text-muted-foreground">
                <span class="font-semibold text-foreground">{{ post.nickname || "익명 유저" }}</span>
                <span>·</span>
                <span>{{ formatTime(post.createdAt) }}</span>
              </div>
              <div class="mt-0.5 flex items-baseline justify-between gap-3">
                <p class="flex-1 !text-sm text-foreground line-clamp-1">
                  {{ toPreviewTitle(post.title, post.content) }}
                </p>
                <span class="shrink-0 flex items-center gap-2 !text-xs tabular-nums">
                  <span :class="isPostLiked(post.id) ? 'text-primary font-semibold' : 'text-muted-foreground'">추천 {{ post.likeCount ?? 0 }}</span>
                  <span class="text-muted-foreground">답글 {{ post.commentCount ?? 0 }}</span>
                </span>
              </div>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="px-4 py-4 !text-sm text-muted-foreground">아직 등록된 글이 없습니다.</p>
        <div v-if="hasMore" class="border-t border-border/50 px-4 py-2.5 text-center">
          <button
            type="button"
            class="retro-button-subtle !px-3 !py-1 !text-xs"
            :disabled="loading"
            @click="loadMore"
          >
            {{ loading ? "불러오는 중..." : "더보기" }}
          </button>
        </div>
      </template>

      <!-- 인기글 -->
      <template v-else>
        <LoadingSpinner v-if="popularLoading" class="p-4" variant="dots" size="sm" />
        <ul v-else-if="popularPosts.length > 0" class="divide-y divide-border/60">
          <li v-for="post in popularPosts" :key="post.id">
            <RouterLink
              :to="`/community/${post.id}`"
              class="block px-4 py-3 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div class="flex items-center gap-1.5 !text-xs text-muted-foreground">
                <span class="font-semibold text-foreground">{{ post.nickname || "익명 유저" }}</span>
                <span>·</span>
                <span>{{ formatTime(post.createdAt) }}</span>
              </div>
              <div class="mt-0.5 flex items-baseline justify-between gap-3">
                <p class="flex-1 !text-sm text-foreground line-clamp-1">
                  {{ toPreviewTitle(post.title, post.content) }}
                </p>
                <span class="shrink-0 flex items-center gap-2 !text-xs tabular-nums">
                  <span :class="isPostLiked(post.id) ? 'text-primary font-semibold' : 'text-muted-foreground'">추천 {{ post.likeCount ?? 0 }}</span>
                  <span class="text-muted-foreground">답글 {{ post.commentCount ?? 0 }}</span>
                </span>
              </div>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="px-4 py-4 !text-sm text-muted-foreground">아직 인기글이 없습니다.</p>
      </template>
    </section>

    <!-- 글쓰기 폼 -->
    <section v-if="communityEnabled" id="community-compose" class="retro-panel overflow-hidden">
      <div class="retro-panel-content space-y-2">
        <div class="flex items-center justify-between">
          <span class="!text-xs font-semibold text-foreground">글쓰기</span>
          <span class="retro-kbd">{{ content.length }}/2000</span>
        </div>
        <form class="space-y-2" @submit.prevent="submitPost">
          <label for="community-post-title" class="sr-only">게시글 제목</label>
          <input
            id="community-post-title"
            v-model="title"
            type="text"
            maxlength="100"
            aria-describedby="community-form-feedback"
            :aria-invalid="Boolean(formError)"
            class="w-full rounded-none border border-border/70 bg-transparent px-2.5 py-1.5 !text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-0"
            placeholder="제목 (2~100자)"
          />
          <label for="community-post-content" class="sr-only">게시글 본문</label>
          <textarea
            id="community-post-content"
            v-model="content"
            rows="5"
            maxlength="2000"
            aria-describedby="community-form-feedback"
            :aria-invalid="Boolean(formError)"
            class="w-full rounded-none border border-border/70 bg-transparent px-2.5 py-1.5 !text-sm leading-relaxed placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-0"
            placeholder="본문을 입력해 주세요."
          />
          <div class="flex items-center justify-between">
            <p v-if="formError" id="community-form-feedback" class="!text-xs text-destructive">{{ formError }}</p>
            <span v-else id="community-form-feedback" class="!text-xs text-muted-foreground">익명으로 등록됩니다.</span>
            <button type="submit" class="retro-button-subtle !px-2 !py-1 !text-xs" :disabled="submitting">
              {{ submitting ? "등록 중..." : "등록" }}
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>
