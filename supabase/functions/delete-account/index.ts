import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ success: false, error: "POST 요청만 허용됩니다." }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return jsonResponse({ success: false, error: "로그인 후 다시 시도해주세요." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anon || !service) {
    console.error("[delete-account] Required server configuration is missing.");
    return jsonResponse({ success: false, error: "서버 설정 오류입니다. 고객센터에 문의해주세요." }, 500);
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return jsonResponse({ success: false, error: "로그인 정보를 확인할 수 없습니다." }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return jsonResponse({ success: false, error: "탈퇴 확인 정보를 읽지 못했습니다." }, 400); }

  if (body?.confirmation !== "탈퇴합니다") {
    return jsonResponse({ success: false, error: "회원 탈퇴 확인 문구를 정확히 입력해주세요." }, 400);
  }

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: owned, error: ownerError } = await admin
    .from("organizations").select("id").eq("owner_id", user.id).limit(1);
  if (ownerError) return jsonResponse({ success: false, error: "회사 소유권 상태를 확인하지 못했습니다." }, 500);
  if (owned?.length) return jsonResponse({
    success: false, code: "ORGANIZATION_OWNER_TRANSFER_REQUIRED",
    error: "회사 대표 계정은 바로 탈퇴할 수 없습니다. 팀 관리에서 대표 권한을 다른 사람에게 이전한 뒤 탈퇴해주세요.",
  }, 409);

  const { data: profile, error: profileError } = await admin
    .from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (profileError) return jsonResponse({ success: false, error: "회사 소속 상태를 확인하지 못했습니다." }, 500);
  if (profile?.organization_id) return jsonResponse({
    success: false, code: "ORGANIZATION_LEAVE_REQUIRED",
    error: "먼저 팀 관리에서 팀 나가기를 완료해야 탈퇴할 수 있습니다. 회사 근무표와 다른 직원의 기록은 보존됩니다.",
  }, 409);

  // This project currently has no Storage buckets. If file uploads are added
  // later, add an authenticated per-user object cleanup step before deletion.

  // The database BEFORE DELETE trigger atomically rechecks organization state,
  // deletes private rows, and anonymizes references in shared company history.
  const { error: deletionError } = await admin.auth.admin.deleteUser(user.id, false);
  if (deletionError) {
    const message = deletionError.message ?? "";
    if (message.includes("ACCOUNT_DELETE_OWNER_TRANSFER_REQUIRED")) {
      return jsonResponse({ success: false, code: "ORGANIZATION_OWNER_TRANSFER_REQUIRED", error: "회사 대표 권한을 먼저 이전해주세요." }, 409);
    }
    if (message.includes("ACCOUNT_DELETE_ORGANIZATION_MEMBER")) {
      return jsonResponse({ success: false, code: "ORGANIZATION_LEAVE_REQUIRED", error: "먼저 팀 관리에서 팀 나가기를 완료해주세요." }, 409);
    }
    console.error("[delete-account] Auth deletion failed:", message);
    return jsonResponse({ success: false, error: "계정 삭제를 완료하지 못했습니다. 계정 데이터는 유지되었습니다." }, 500);
  }

  return jsonResponse({ success: true, message: "회원 탈퇴와 계정 데이터 삭제가 완료되었습니다." });
});
