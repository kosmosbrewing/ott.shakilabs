export type JsonRecord = Record<string, unknown>;

export interface ServicePlan {
  id: string;
  name: string;
  nameEn?: string;
  [key: string]: unknown;
}

export interface ServiceInfo {
  id: string;
  name: string;
  slug: string;
  active?: boolean;
  color?: string;
  plans?: ServicePlan[];
  [key: string]: unknown;
}

export interface ServicesResponse {
  services: ServiceInfo[];
}

export interface CountryPlanPrice {
  monthly?: number;
  yearly?: number;
  [key: string]: number | undefined;
}

export interface ConvertedAmount {
  krw?: number;
  usd?: number;
  [key: string]: number | undefined;
}

export interface CountryPrice {
  countryCode: string;
  country?: string;
  continent?: string;
  currency?: string;
  plans?: Record<string, CountryPlanPrice | undefined>;
  converted?: Record<string, ConvertedAmount | undefined>;
  [key: string]: unknown;
}

export interface PricesResponse {
  prices: CountryPrice[];
  baseCountry?: string;
  lastUpdated?: string;
  exchangeRateDate?: string;
  krwRate?: number;
  [key: string]: unknown;
}

export interface TrendPoint {
  date: string;
  krw: number;
  [key: string]: unknown;
}

export interface TrendRow {
  countryCode: string;
  country: string;
  previousKrw?: number;
  currentKrw?: number;
  changeKrw?: number;
  changePercent?: number;
  savingsPercent?: number;
  krw?: number;
  localMonthly?: number;
  currency?: string;
  [key: string]: unknown;
}

// 수집 시점별 원화 환산 가격 타임라인 1행 (기준국 + 변동 상위 국가 샘플)
export interface TrendTimelineRow {
  country: string;
  countryCode: string;
  points: TrendPoint[];
  // 직전 스냅샷 대비 최신 변동률(%) — 시계열 점이 2개 미만이면 null
  changePercent: number | null;
  [key: string]: unknown;
}

export interface TrendsResponse {
  asOf?: string | null;
  previousSnapshotDate?: string | null;
  exchangeRateDate?: string | null;
  cheapest?: TrendRow[];
  highestSavings?: TrendRow[];
  biggestDrops?: TrendRow[];
  countryChanges?: Record<string, TrendPoint[]>;
  timeline?: TrendTimelineRow[];
  [key: string]: unknown;
}

export interface CommunityPost {
  id: string;
  serviceSlug?: string;
  countryCode?: string;
  title?: string;
  nickname?: string;
  content?: string;
  createdAt?: string;
  commentCount?: number;
  likeCount?: number;
  [key: string]: unknown;
}

export interface CommunityPostResponse {
  post: CommunityPost;
  [key: string]: unknown;
}

export interface CommunityPostsResponse {
  posts: CommunityPost[];
  total?: number;
  hasMore?: boolean;
  [key: string]: unknown;
}

export interface CommunityComment {
  id: string;
  postId?: string;
  nickname?: string;
  content?: string;
  createdAt?: string;
  likeCount?: number;
  [key: string]: unknown;
}

export interface CommentsResponse {
  comments: CommunityComment[];
  [key: string]: unknown;
}

export interface CommunityThreadResponse {
  post: CommunityPost;
  comments: CommunityComment[];
  hasMore: boolean;
  [key: string]: unknown;
}

export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}

export interface CountryVotePayload {
  serviceSlug: string;
  countryCode: string;
  allowRevote?: boolean;
}

export interface CountryVoteResult {
  countryCode: string;
  country: string;
  voteCount: number;
}

export interface CountryVoteResultsResponse {
  results: CountryVoteResult[];
  totalVotes: number;
}

export interface CountryVoteResponse {
  voted: boolean;
  countryCode: string;
  revoted?: boolean;
}

export interface PopularPostsResponse {
  posts: CommunityPost[];
}
