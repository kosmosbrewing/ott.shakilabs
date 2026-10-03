// scripts/primary-nav-items.mjs(단일 소스)를 src에서 타입과 함께 쓰기 위한 선언
export interface PrimaryNavItem {
  key: string;
  label: string;
  to: string;
}

export const PRIMARY_NAV_ITEMS: readonly PrimaryNavItem[];
export function findActiveNavItem(path: string): PrimaryNavItem | undefined;
