import { NextRequest, NextResponse } from "next/server";
import type { PexipApiRequest } from "@/lib/types";

// Pexip 서버가 자체 서명 인증서를 사용하는 경우 Node.js 검증 비활성화
// 운영 환경에서는 인증서를 올바르게 구성하고 이 옵션을 제거하세요
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export async function POST(request: NextRequest) {
  try {
    const body: PexipApiRequest = await request.json();
    const { pexipUrl, username, password, endpoint, params = {} } = body;

    if (!pexipUrl || !username || !password || !endpoint) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }

    // URL 정규화 (trailing slash 제거)
    const baseUrl = pexipUrl.replace(/\/$/, "");

    // 쿼리 파라미터 조합
    const queryString = new URLSearchParams(params).toString();
    const targetUrl = `${baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`;

    // Basic Auth 헤더 생성
    const credentials = Buffer.from(`${username}:${password}`).toString("base64");

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: "인증 실패: 사용자명 또는 비밀번호를 확인하세요." },
          { status: 401 }
        );
      }
      if (response.status === 403) {
        return NextResponse.json(
          { error: "접근 권한이 없습니다. 관리자 계정인지 확인하세요." },
          { status: 403 }
        );
      }
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Pexip API 오류 (${response.status}): ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Pexip Proxy Error]", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    // 네트워크 연결 오류 처리
    if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        { error: "Pexip 서버에 연결할 수 없습니다. URL을 확인하세요." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
