import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pexip 서버의 자체 서명 인증서를 허용 (개발/사내망 환경)
  // 운영 환경에서는 제거하거나 NODE_EXTRA_CA_CERTS를 사용하세요
};

export default nextConfig;
