import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next dev 가 CLAUDE.md 를 자동 생성/수정하지 않게 한다 (프로젝트 규칙 파일은 직접 관리)
  agentRules: false,
};

export default nextConfig;
