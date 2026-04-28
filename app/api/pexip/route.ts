import { NextRequest, NextResponse } from "next/server";
import https from "node:https";
import http from "node:http";
import type { PexipApiRequest } from "@/lib/types";

// HTML 태그 제거 (에러 메시지 정제용)
function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

// node:https 모듈을 사용하여 자체 서명 인증서(SSL)를 신뢰하는 fetch 함수
// Vercel serverless 환경에서도 rejectUnauthorized: false 가 안정적으로 동작함
function secureFetch(
  url: string,
  headers: Record<string, string>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : isHttps ? 443 : 80,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers,
      // 자체 서명 인증서 허용 (사내 Pexip 서버 대응)
      rejectUnauthorized: false,
    };

    const transport = isHttps ? https : http;

    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf-8"),
        })
      );
    });

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("요청 시간이 초과되었습니다 (15초)"));
    });
    req.end();
  });
}

export async function POST(request: NextRequest) {
  let body: PexipApiRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { pexipUrl, username, password, endpoint, params = {} } = body;

  if (!pexipUrl || !username || !password || !endpoint) {
    return NextResponse.json(
      { error: "필수 파라미터(URL, 계정, 엔드포인트)가 누락되었습니다." },
      { status: 400 }
    );
  }

  // URL 정규화
  const baseUrl = pexipUrl.trim().replace(/\/$/, "");

  // http:// 또는 https:// 없으면 자동으로 https:// 추가
  const normalizedBase = /^https?:\/\//i.test(baseUrl)
    ? baseUrl
    : `https://${baseUrl}`;

  const queryString = new URLSearchParams(params as Record<string, string>).toString();
  const targetUrl = `${normalizedBase}${endpoint}${queryString ? `?${queryString}` : ""}`;

  // Basic Auth 헤더
  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  try {
    const { status, body: responseBody } = await secureFetch(targetUrl, {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    });

    // 성공
    if (status >= 200 && status < 300) {
      try {
        const json = JSON.parse(responseBody);
        return NextResponse.json(json);
      } catch {
        return NextResponse.json(
          { error: "Pexip 응답이 JSON 형식이 아닙니다. API 경로를 확인하세요." },
          { status: 502 }
        );
      }
    }

    // 에러 응답 처리
    const isHtml = responseBody.trimStart().startsWith("<");
    const errorMessage = isHtml ? stripHtml(responseBody) : responseBody.slice(0, 300);

    if (status === 401) {
      return NextResponse.json(
        { error: "인증 실패 (401): 사용자명 또는 비밀번호를 확인하세요." },
        { status: 401 }
      );
    }
    if (status === 403) {
      return NextResponse.json(
        { error: "접근 권한 없음 (403): 관리자(admin) 계정인지 확인하세요." },
        { status: 403 }
      );
    }
    if (status === 404) {
      return NextResponse.json(
        {
          error: `API 경로를 찾을 수 없습니다 (404).\n요청 URL: ${targetUrl}\nPexip 서버 응답: ${errorMessage}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: `Pexip API 오류 (${status}): ${errorMessage}` },
      { status }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        { error: `연결 거부됨: ${normalizedBase} 에 접속할 수 없습니다. URL을 확인하세요.` },
        { status: 503 }
      );
    }
    if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
      return NextResponse.json(
        { error: `DNS 조회 실패: 호스트 주소를 확인하세요. (${normalizedBase})` },
        { status: 503 }
      );
    }
    if (message.includes("ETIMEDOUT") || message.includes("초과")) {
      return NextResponse.json(
        { error: `연결 시간 초과: Pexip 서버 응답이 없습니다. (${normalizedBase})` },
        { status: 504 }
      );
    }
    if (message.includes("CERT") || message.includes("certificate")) {
      return NextResponse.json(
        { error: `SSL 인증서 오류: ${message}` },
        { status: 502 }
      );
    }

    console.error("[Pexip Proxy Error]", err);
    return NextResponse.json({ error: `서버 오류: ${message}` }, { status: 500 });
  }
}
