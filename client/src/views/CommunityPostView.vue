<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useCommunityPost } from "@/composables/useCommunityPost";
import { useLike } from "@/composables/useLike";
import { useSEO } from "@/composables/useSEO";
import { toggleCommentLike } from "@/api";
import { LoadingSpinner } from "@/components/ui/loading";
import { ThumbsUp } from "lucide-vue-next";
import { COMMUNITY_ENABLED } from "@/lib/features";
import { COMMUNITY_POST_META, appPageTitle } from "../../scripts/page-meta.mjs";

const route = useRoute();
const postId = computed(() => {
  const raw = route.params.postId;
  return typeof raw === "string" ? raw : "";
});

const {
  post,
  comments,
  loading,
  error,
  submitting,
  formError,
  loadingMore,
  hasMoreComments,
  loadMoreComments,
  onSubmit,
} = useCommunityPost(() => (COMMUNITY_ENABLED ? postId.value : ""));
// 꺼져 있으면 빈 ID를 넘겨 요청 자체를 만들지 않는다(lib/features.ts). 화면은 아래 첫 분기가 맡는다.
const content = ref("");

// 좋아요 composable
const { liked, likeCount, toggling, toggle } = useLike(postId, 0);

// post 로드 후 likeCount 초기값 동기화
watch(post, (p) => {
  if (p?.likeCount != null) {
    likeCount.value = p.likeCount;
  }
});

// 댓글 좋아요 상태 — commentId → { liked, likeCount, toggling }
type CommentLikeState = { liked: boolean; likeCount: number; toggling: boolean };
const commentLikeMap = ref<Map<string, CommentLikeState>>(new Map());

// 댓글 로드 후 likeCount 초기화 — 제거된 댓글은 Map에서 정리
watch(comments, (list) => {
  const next = new Map<string, CommentLikeState>();
  for (const c of list) {
    next.set(c.id, commentLikeMap.value.get(c.id) ?? {
      liked: false,
      likeCount: c.likeCount ?? 0,
      toggling: false,
    });
  }
  commentLikeMap.value = next;
}, { immediate: true });

function getCommentLike(commentId: string): CommentLikeState {
  return commentLikeMap.value.get(commentId) ?? { liked: false, likeCount: 0, toggling: false };
}

async function onToggleCommentLike(commentId: string): Promise<void> {
  const state = commentLikeMap.value.get(commentId);
  if (!state || state.toggling || !postId.value) return;

  // 낙관적 업데이트
  const prev = { ...state };
  commentLikeMap.value.set(commentId, {
    liked: !state.liked,
    likeCount: state.liked ? Math.max(0, state.likeCount - 1) : state.likeCount + 1,
    toggling: true,
  });

  try {
    const result = await toggleCommentLike(postId.value, commentId);
    commentLikeMap.value.set(commentId, {
      liked: result.liked,
      likeCount: result.likeCount,
      toggling: false,
    });
  } catch {
    // 롤백
    commentLikeMap.value.set(commentId, { ...prev, toggling: false });
  }
}

const pageTitle = computed(() => {
  if (!post.value) return COMMUNITY_POST_META.title;
  const normalizedTitle = (post.value.title || "").trim();
  return appPageTitle(normalizedTitle || `${post.value.nickname || "익명 유저"}의 글`);
});

const pageDescription = computed(() => {
  if (!post.value?.content) return COMMUNITY_POST_META.description;
  return post.value.content.slice(0, 120);
});

useSEO({
  title: pageTitle,
  description: pageDescription,
  noindex: true,
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

async function submitForm(): Promise<void> {
  const success = await onSubmit(content.value);
  if (success) {
    content.value = "";
  }
}
</script>

<template>
  <div class="container max-w-xl py-8 space-y-4">
    <div v-if="!COMMUNITY_ENABLED" class="retro-panel overflow-hidden">
      <div class="retro-panel-content space-y-2">
        <h1 class="text-body font-semibold text-foreground">커뮤니티</h1>
        <p class="text-body text-muted-foreground">커뮤니티 게시판은 현재 운영하지 않습니다.</p>
        <RouterLink to="/youtube-premium" class="inline-block text-sm text-primary hover:underline">
          유튜브 프리미엄 국가별 요금 보기 →
        </RouterLink>
      </div>
    </div>

    <template v-else>
    <RouterLink to="/community" class="retro-button-subtle inline-flex !px-2 !py-1 !text-xs">
      ← 커뮤니티
    </RouterLink>

    <LoadingSpinner v-if="loading" message="게시글을 불러오는 중..." />

    <div v-else-if="error" class="retro-panel overflow-hidden">
      <div class="retro-panel-content">
        <p class="text-body text-destructive">{{ error }}</p>
        <RouterLink to="/community" class="mt-3 inline-block text-sm text-primary hover:underline">
          커뮤니티 목록으로 이동
        </RouterLink>
      </div>
    </div>

    <section v-else-if="post" class="retro-panel overflow-hidden">
      <!-- 원글 -->
      <div class="px-4 py-3">
        <h2 v-if="post.title" class="text-body font-semibold leading-snug text-foreground">
          {{ post.title }}
        </h2>
        <div class="flex items-center justify-between gap-2" :class="post.title ? 'mt-1' : ''">
          <div class="flex items-center gap-1.5 !text-xs text-muted-foreground">
            <span class="font-semibold text-foreground">{{ post.nickname || "익명 유저" }}</span>
            <span>·</span>
            <span>{{ formatTime(post.createdAt) }}</span>
          </div>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1 rounded-sm border px-2 py-0.5 !text-caption font-semibold transition-colors"
            :class="liked ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary'"
            :disabled="toggling"
            @click="toggle"
          >
            <ThumbsUp class="h-3.5 w-3.5" />
            <span class="tabular-nums">{{ likeCount }}</span>
          </button>
        </div>
        <p class="mt-2 whitespace-pre-line text-body leading-relaxed text-foreground">
          {{ post.content }}
        </p>
      </div>

      <!-- 답글 목록 -->
      <div class="border-t border-border/60 px-4 py-3">
        <div class="mb-2 flex items-center gap-1.5 !text-xs text-muted-foreground">
          <span class="font-semibold text-primary">↳</span>
          <h2 class="font-semibold text-foreground">답글</h2>
        </div>
        <ul v-if="comments.length > 0" class="ml-2 md:ml-4">
          <li v-for="(comment, index) in comments" :key="comment.id" class="relative pl-5" :class="index > 0 ? 'border-t border-border/60 pt-3 mt-3' : ''">
            <span class="absolute left-2 top-3 bottom-2 w-px bg-border/70" aria-hidden="true" />
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 !text-xs text-muted-foreground">
                <span class="font-semibold text-foreground">{{ comment.nickname || "익명 유저" }}</span>
                <span>·</span>
                <span>{{ formatTime(comment.createdAt) }}</span>
              </div>
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1 rounded-sm border px-2 py-0.5 !text-caption font-semibold transition-colors"
                :class="getCommentLike(comment.id).liked
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary'"
                :disabled="getCommentLike(comment.id).toggling"
                @click="onToggleCommentLike(comment.id)"
              >
                <ThumbsUp class="h-3 w-3" />
                <span class="tabular-nums">{{ getCommentLike(comment.id).likeCount }}</span>
              </button>
            </div>
            <p class="mt-1 whitespace-pre-line !text-sm leading-[1.35] text-foreground">
              {{ comment.content }}
            </p>
          </li>
        </ul>
        <div v-else class="ml-2 relative pl-5 md:ml-4">
          <span class="absolute left-2 top-0 h-full w-px bg-border/70" aria-hidden="true" />
          <p class="!text-sm text-muted-foreground">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</p>
        </div>
        <div v-if="hasMoreComments" class="ml-2 mt-2 md:ml-4">
          <button
            type="button"
            class="retro-button-subtle !px-2 !py-1 !text-xs"
            :disabled="loadingMore"
            @click="loadMoreComments"
          >
            {{ loadingMore ? "불러오는 중..." : "댓글 더보기" }}
          </button>
        </div>
      </div>

      <!-- 댓글 작성 폼 -->
      <div class="border-t border-border/60 px-4 py-3 space-y-2">
        <div class="flex items-center justify-between">
          <span class="!text-xs font-semibold text-foreground">댓글 쓰기</span>
          <span class="retro-kbd">{{ content.length }}/300</span>
        </div>
        <form class="space-y-2" @submit.prevent="submitForm">
          <textarea
            v-model="content"
            rows="3"
            maxlength="300"
            class="w-full rounded-none border border-border/70 bg-transparent px-2.5 py-1.5 !text-sm leading-relaxed placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-0"
            placeholder="댓글을 입력해 주세요."
          />
          <div class="flex items-center justify-between">
            <p v-if="formError" class="!text-xs text-destructive">{{ formError }}</p>
            <span v-else class="!text-xs text-muted-foreground">익명으로 등록됩니다.</span>
            <button type="submit" class="retro-button-subtle !px-2 !py-1 !text-xs" :disabled="submitting">
              {{ submitting ? "등록 중..." : "댓글 등록" }}
            </button>
          </div>
        </form>
      </div>
    </section>
    </template>
  </div>
</template>
