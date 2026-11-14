import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type FormQuestion = {
  entry_id: string;
  label: string;
  required: boolean;
  question_type: number | null;
  choices: string[];
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

function normalizeGoogleFormsUrl(input: string): { formId: string; url: string } {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error("Google Forms 링크를 올바르게 입력해주세요.");
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "docs.google.com") {
    throw new Error("docs.google.com의 Google Forms 링크만 등록할 수 있습니다.");
  }

  const match = parsed.pathname.match(
    /^\/forms\/(?:u\/\d+\/)?d\/e\/([^/]+)\/viewform\/?$/,
  );

  if (!match?.[1]) {
    throw new Error("Google Forms의 /forms/d/e/.../viewform 링크를 입력해주세요.");
  }

  const formId = match[1];
  return {
    formId,
    url: `https://docs.google.com/forms/d/e/${formId}/viewform`,
  };
}

function extractAssignedJsonArray(html: string, variableName: string): unknown[] | null {
  const assignment = new RegExp(variableName + "\\s*=\\s*", "g");
  let match: RegExpExecArray | null;

  while ((match = assignment.exec(html)) !== null) {
    const start = html.indexOf("[", assignment.lastIndex);
    if (start < 0) continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < html.length; index += 1) {
      const char = html[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === "[") {
        depth += 1;
      } else if (char === "]") {
        depth -= 1;
        if (depth === 0) {
          try {
            const parsed: unknown = JSON.parse(html.slice(start, index + 1));
            if (Array.isArray(parsed)) return parsed;
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

function firstTextValue(value: unknown): string {
  if (typeof value === "string") return stripHtml(value);
  if (!Array.isArray(value)) return "";

  for (const item of value) {
    const result = firstTextValue(item);
    if (result) return result;
  }
  return "";
}

function parseFbPublicLoadDataQuestions(html: string): FormQuestion[] {
  const data = extractAssignedJsonArray(html, "FB_PUBLIC_LOAD_DATA_");
  const formItems = Array.isArray(data?.[1]) && Array.isArray(data[1][1])
    ? data[1][1]
    : [];

  const questions: FormQuestion[] = [];
  const seen = new Set<string>();

  for (const item of formItems) {
    if (!Array.isArray(item)) continue;

    const label = stripHtml(String(item[1] ?? ""));
    const rawQuestionType = item[3];
    const questionType = rawQuestionType === null || rawQuestionType === undefined
      ? null
      : Number.isFinite(Number(rawQuestionType))
        ? Number(rawQuestionType)
        : null;
    const configs = Array.isArray(item[4]) ? item[4] : [];

    if (!label) continue;

    for (const config of configs) {
      if (!Array.isArray(config)) continue;

      const rawEntryId = config[0];
      if (rawEntryId === null || rawEntryId === undefined) continue;

      const entryId = String(rawEntryId);
      if (!/^\d+$/.test(entryId) || seen.has(entryId)) continue;
      seen.add(entryId);

      const rawChoices = Array.isArray(config[1]) ? config[1] : [];
      const choices = rawChoices
        .map((choice: unknown) => firstTextValue(choice))
        .filter(Boolean);

      questions.push({
        entry_id: entryId,
        label,
        required: Boolean(config[2]),
        question_type: questionType,
        choices,
      });
    }
  }

  return questions;
}

function parseDataParamsQuestions(html: string): FormQuestion[] {
  const questions: FormQuestion[] = [];
  const seen = new Set<string>();
  const regex = /data-params="([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const decoded = decodeHtmlEntities(match[1]);
      const jsonStart = decoded.indexOf("[");
      if (jsonStart < 0) continue;

      const parsed = JSON.parse(decoded.slice(jsonStart));
      if (!Array.isArray(parsed)) continue;

      const config = Array.isArray(parsed[4]) ? parsed[4][0] : null;
      const rawEntryId = config?.[0];
      const label = stripHtml(String(parsed[1] ?? ""));
      if (rawEntryId === undefined || rawEntryId === null || !label) continue;

      const entryId = String(rawEntryId);
      if (!/^\d+$/.test(entryId) || seen.has(entryId)) continue;
      seen.add(entryId);

      const rawChoices = Array.isArray(config?.[1]) ? config[1] : [];
      const choices = rawChoices
        .map((choice: unknown) => firstTextValue(choice))
        .filter(Boolean);

      questions.push({
        entry_id: entryId,
        label,
        required: Boolean(config?.[2]),
        question_type: Number.isFinite(Number(parsed[3])) ? Number(parsed[3]) : null,
        choices,
      });
    } catch {
      // data-params가 질문 외부 요소이거나 현재 Google Forms 형식과 다르면 건너뜁니다.
    }
  }

  return questions;
}

function parseQuestions(html: string): FormQuestion[] {
  // Google Forms' public response page normally embeds its schema as FB_PUBLIC_LOAD_DATA_.
  // Retain data-params parsing as a fallback for alternate page versions.
  const embeddedQuestions = parseFbPublicLoadDataQuestions(html);
  if (embeddedQuestions.length > 0) return embeddedQuestions;
  return parseDataParamsQuestions(html);
}

function chooseUnique(
  questions: FormQuestion[],
  predicate: (question: FormQuestion) => boolean,
): string | null {
  const matches = questions.filter(predicate);
  return matches.length === 1 ? matches[0].entry_id : null;
}

function suggestMapping(questions: FormQuestion[]) {
  const invoice = chooseUnique(questions, (question) =>
    /(운송장번호|송장번호|택배번호|주문번호)/i.test(question.label)
  );
  const driver = chooseUnique(questions, (question) =>
    /(기사님\s*아이디|기사\s*아이디|아이디)/i.test(question.label)
  );
  const quantity = chooseUnique(questions, (question) =>
    /(채번\s*수량|수량)/i.test(question.label)
  );
  const camp = chooseUnique(questions, (question) =>
    /(요청\s*캠프|캠프|거점)/i.test(question.label)
  );

  const mappedIds = new Set([invoice, driver, quantity, camp].filter(Boolean));
  const staticFields = questions
    .filter((question) =>
      question.required &&
      !mappedIds.has(question.entry_id) &&
      question.choices.some((choice) => /채번\s*요청/.test(choice))
    )
    .map((question) => ({
      entry_id: question.entry_id,
      value: question.choices.find((choice) => /채번\s*요청/.test(choice)) ?? "채번 요청",
    }));

  return {
    invoice_entry_id: invoice,
    driver_id_entry_id: driver,
    quantity_entry_id: quantity,
    camp_entry_id: camp,
    static_fields: staticFields,
  };
}

function getFormTitle(html: string): string {
  const match = html.match(
    /role="heading"[^>]*aria-level="1"[^>]*>([\s\S]*?)<\/div>/i,
  );
  return match ? stripHtml(match[1]) : "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "POST 요청만 허용됩니다." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ success: false, error: "서버 환경변수가 설정되지 않았습니다." }, 500);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  const user = authData?.user;
  if (authError || !user) {
    return jsonResponse({ success: false, error: "지역 양식 등록은 로그인 후 이용할 수 있습니다." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let formUrl = "";
  let campName = "";
  let formId: string | null = null;

  const writeReport = async (report: {
    status: "ready" | "needs_mapping" | "error";
    title?: string;
    questions?: FormQuestion[];
    mapping?: ReturnType<typeof suggestMapping>;
    errorMessage?: string | null;
  }) => {
    const { error } = await adminClient.from("camp_return_form_reports").insert({
      user_id: user.id,
      user_email: user.email ?? "",
      camp_name: campName,
      form_url: formUrl,
      form_id: formId,
      form_title: report.title ?? "",
      status: report.status,
      questions: report.questions ?? [],
      suggested_mapping: report.mapping ?? {},
      error_message: report.errorMessage ?? null,
    });
    if (error) console.error("[analyze-camp-return-form] report insert failed:", error.message);
  };

  try {
    const body = await request.json();
    formUrl = String(body?.formUrl ?? "").trim();
    campName = String(body?.campName ?? "").trim();

    if (!campName || campName.length > 80) {
      throw new Error("캠프명을 1~80자로 입력해주세요.");
    }

    const normalized = normalizeGoogleFormsUrl(formUrl);
    formId = normalized.formId;

    const response = await fetch(normalized.url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; DeliveryTrackerFormAnalyzer/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Google Forms 페이지를 열지 못했습니다. (HTTP ${response.status})`);
    }

    const finalUrl = new URL(response.url);
    if (finalUrl.hostname !== "docs.google.com") {
      throw new Error("Google Forms가 아닌 외부 페이지로 이동되어 분석을 중단했습니다.");
    }

    const html = await response.text();
    if (!html || html.length > 4_000_000) {
      throw new Error("양식 HTML이 비어 있거나 허용 크기(4MB)를 초과했습니다.");
    }

    const questions = parseQuestions(html);
    if (questions.length === 0) {
      throw new Error("양식의 질문 정보를 읽지 못했습니다. 공개 권한과 Google Forms 페이지 구조를 확인해주세요.");
    }

    const title = getFormTitle(html);
    const mapping = suggestMapping(questions);
    const requiredCampQuestion = questions.some(
      (question) =>
        question.required &&
        /(요청\\s*캠프|캠프|거점)/i.test(question.label),
    );
    const ready = Boolean(
      mapping.invoice_entry_id &&
      mapping.driver_id_entry_id &&
      mapping.quantity_entry_id &&
      (!requiredCampQuestion || mapping.camp_entry_id)
    );

    await writeReport({
      status: ready ? "ready" : "needs_mapping",
      title,
      questions,
      mapping,
    });

    return jsonResponse({
      success: true,
      form_id: formId,
      form_url: normalized.url,
      title,
      questions,
      suggested_mapping: mapping,
      status: ready ? "ready" : "needs_mapping",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "양식 분석 중 알 수 없는 오류가 발생했습니다.";
    await writeReport({ status: "error", errorMessage: message });
    console.error("[analyze-camp-return-form]", message);
    return jsonResponse({ success: false, error: message }, 400);
  }
});
