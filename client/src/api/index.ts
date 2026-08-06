/**
 * API 레이어 진입점 — 도메인별 모듈에서 re-export
 * 기존 import 경로(`@/api`)와의 하위 호환성 유지
 */

// 타입
export type {
  JsonRecord,
  ServicePlan,
  ServiceInfo,
  ServicesResponse,
  CountryPlanPrice,
  ConvertedAmount,
  CountryPrice,
  PricesResponse,
  TrendPoint,
  TrendRow,
  TrendTimelineRow,
  TrendsResponse,
  CommunityPost,
  CommunityPostResponse,
  CommunityPostsResponse,
  CommunityComment,
  CommentsResponse,
  CommunityThreadResponse,
  LikeResponse,
  CountryVotePayload,
  CountryVoteResult,
  CountryVoteResultsResponse,
  CountryVoteResponse,
  PopularPostsResponse,
} from "./types";

// 서비스
export { fetchServices } from "./services";

// 가격
export { fetchPrices } from "./prices";

// 트렌드
export { fetchTrends } from "./trends";

// 커뮤니티 + 알림
export {
  subscribePriceAlert,
  fetchCommunityPosts,
  fetchAllCommunityPosts,
  fetchCommunityPost,
  fetchPostComments,
  fetchCommunityThread,
  submitComment,
  submitCommunityPost,
  togglePostLike,
  toggleCommentLike,
  fetchPopularPosts,
  submitCountryVote,
  fetchVoteResults,
} from "./community";

// default export (하위 호환)
import { fetchServices } from "./services";
import { fetchPrices } from "./prices";
import { fetchTrends } from "./trends";
import {
  subscribePriceAlert,
  fetchCommunityPosts,
  fetchAllCommunityPosts,
  fetchCommunityPost,
  fetchCommunityThread,
  fetchPostComments,
  submitCommunityPost,
  submitComment,
  togglePostLike,
  toggleCommentLike,
  fetchPopularPosts,
  submitCountryVote,
  fetchVoteResults,
} from "./community";

const api = {
  fetchServices,
  fetchPrices,
  fetchTrends,
  subscribePriceAlert,
  fetchCommunityPosts,
  fetchAllCommunityPosts,
  fetchCommunityPost,
  fetchCommunityThread,
  fetchPostComments,
  submitCommunityPost,
  submitComment,
  togglePostLike,
  toggleCommentLike,
  fetchPopularPosts,
  submitCountryVote,
  fetchVoteResults,
};

export default api;
