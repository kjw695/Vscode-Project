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

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "docs.google.com" ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    throw new Error("최종 주소가 안전한 Google Forms 주소가 아닙니다.");
  }

  const match = parsed.pathname.match(
    /^\/forms\/(?:u\/\d+\/)?d\/e\/([^/]+)\/(?:viewform|formResponse)\/?$/,
  );

  if (!match?.[1]) {
    throw new Error("Google Forms의 공유 링크(/viewform) 또는 응답 링크(/formResponse)를 입력해주세요.");
  }

  const formId = match[1];
  return {
    formId,
    url: \`https://docs.google.com/forms/d/e/\${formId}/viewform\`,
  };
}

async function fetchGoogleFormsPage(
  input: string,
): Promise<{ formId: string; url: string; response: Response }> {
  let initialUrl: URL;
  try {
    initialUrl = new URL(input.trim());
  } catch {
    throw new Error("Google Forms 링크를 올바르게 입력해주세요.");
  }

  const allowedHosts = new Set(["forms.gle", "docs.google.com"]);
  const isAllowedUrl = (url: URL) =>
    url.protocol === "https:" &&
    allowedHosts.has(url.hostname) &&
    !url.username &&
    !url.password &&
    !url.port;

  if (!isAllowedUrl(initialUrl)) {
    throw new Error("docs.google.com 또는 forms.gle의 HTTPS 링크만 등록할 수 있습니다.");
  }

  // Normalize long URLs directly. Resolve short links manually and validate
  // each redirect hop so the Edge Function never fetches an external host.
  let currentUrl = initialUrl.hostname === "docs.google.com"
    ? normalizeGoogleFormsUrl(initialUrl.toString()).url
    : initialUrl.toString();

  const redirectStatuses = new Set([301, 302, 303, 307, 308]);
  const headers = {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "Mozilla/5.0 (compatible; DeliveryTrackerFormAnalyzer/1.0)",
  };

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const currentParsedUrl = new URL(currentUrl);
    if (!isAllowedUrl(currentParsedUrl)) {
      throw new Error("Google Forms가 아닌 외부 주소로 이동되어 분석을 중단했습니다.");
    }

    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers,
    });

    if (redirectStatuses.has(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();

      if (!location) {
        throw new Error("Google Forms 단축 링크의 이동 주소를 확인할 수 없습니다.");
      }
      if (redirectCount === 5) {
        throw new Error("Google Forms 단축 링크의 이동 단계가 너무 많습니다.");
      }

      const nextUrl = new URL(location, currentParsedUrl);
      if (!isAllowedUrl(nextUrl)) {
        throw new Error("Google Forms가 아닌 외부 주소로 이동되어 분석을 중단했습니다.");
      }
      currentUrl = nextUrl.toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(\`Google Forms 페이지를 열지 못했습니다. (HTTP \${response.status})\`);
    }

    const finalUrl = response.url ? new URL(response.url) : currentParsedUrl;
    const normalized = normalizeGoogleFormsUrl(finalUrl.toString());
    return { ...normalized, response };
  }

  throw new Error("Google Forms 단축 링크를 확인하지 못했습니다.");
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

    const extractedLabel = stripHtml(String(item[1] ?? ""));
    const label = extractedLabel || "질문명 없음";
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
      const extractedLabel = stripHtml(String(parsed[1] ?? ""));
      const label = extractedLabel || "질문명 없음";
      if (rawEntryId === undefined || rawEntryId === null) continue;

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
  // Google Forms may expose overlapping but incomplete question metadata through
  // FB_PUBLIC_LOAD_DATA_ and data-params. Merge both by entry ID so one partial
  // parser result does not hide fields found by the other format.
  const parsedSets = [
    parseFbPublicLoadDataQuestions(html),
    parseDataParamsQuestions(html),
  ];
  const merged = new Map<string, FormQuestion>();

  for (const question of parsedSets.flat()) {
    const existing = merged.get(question.entry_id);
    if (!existing) {
      merged.set(question.entry_id, question);
      continue;
    }

    const existingHasLabel = existing.label !== "질문명 없음";
    const incomingHasLabel = question.label !== "질문명 없음";
    const preferredLabel = !existingHasLabel && incomingHasLabel
      ? question.label
      : existing.label.length >= question.label.length
        ? existing.label
        : question.label;
    merged.set(question.entry_id, {
      ...existing,
      label: preferredLabel,
      required: existing.required || question.required,
      question_type: existing.question_type ?? question.question_type,
      choices: Array.from(new Set([...existing.choices, ...question.choices])),
    });
  }

  return Array.from(merged.values());
}

function normalizeQuestionLabel(label: string): string {
  return String(label || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/^\s*\d+\s*[.)、:：-]?\s*/, "")
    .replace(/[\s\u200B-\u200D\uFEFF*＊]/g, "")
    .replace(/[(){}:：.,，!?！？]/g, "")
    .replaceAll("[", "")
    .replaceAll("]", "");
}

function chooseByPriority(
  questions: FormQuestion[],
  predicates: Array<(question: FormQuestion) => boolean>,
): string | null {
  for (const predicate of predicates) {
    const matches = questions.filter(predicate);
    if (matches.length === 1) return matches[0].entry_id;
    if (matches.length > 1) return null;
  }
  return null;
}

function isCampRelatedQuestion(question: FormQuestion): boolean {
  return /(캠프|거점)/.test(normalizeQuestionLabel(question.label));
}

function isCompactMobileCampChoice(value: string): boolean {
  const normalized = normalizeQuestionLabel(value);
  return /^[a-z가-힣0-9_-]{2,24}$/i.test(normalized) &&
    /(mb|mobile)$/i.test(normalized);
}

function chooseCampDestinationQuestion(questions: FormQuestion[]): FormQuestion | null {
  const candidates = questions.filter((question) =>
    isCampRelatedQuestion(question) && question.choices.length > 0
  );

  // This form has two questions both named "요청 모바일 캠프":
  // the first contains short choices (학천MB/농소MB), while the conditional
  // follow-up contains descriptive values (캠프명 + area). Use the short
  // selector as the app-facing camp choice.
  const mobileCampQuestions = candidates.filter((question) =>
    /요청모바일캠프/.test(normalizeQuestionLabel(question.label))
  );
  const compactChoices = mobileCampQuestions.filter((question) =>
    question.choices.length > 0 &&
    question.choices.every(isCompactMobileCampChoice)
  );
  if (compactChoices.length === 1) return compactChoices[0];
  if (compactChoices.length > 1) {
    const dropdowns = compactChoices.filter((question) => question.question_type === 2);
    if (dropdowns.length === 1) return dropdowns[0];
    return null;
  }

  const priorities: Array<(question: FormQuestion) => boolean> = [
    (question) => /^기본요청캠프/.test(normalizeQuestionLabel(question.label)),
    (question) => /^요청캠프/.test(normalizeQuestionLabel(question.label)),
    (question) => /^요청.*캠프/.test(normalizeQuestionLabel(question.label)),
    (question) => /(요청|반품).*(캠프|거점)/.test(normalizeQuestionLabel(question.label)),
    (question) => /^캠프명/.test(normalizeQuestionLabel(question.label)),
    (question) => isCampRelatedQuestion(question),
  ];

  for (const predicate of priorities) {
    const matches = candidates.filter(predicate);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const optionalWithChoices = matches.filter((question) => !question.required);
      if (optionalWithChoices.length === 1) return optionalWithChoices[0];
      return null;
    }
  }
  return null;
}

function buildLinkedFields(
  questions: FormQuestion[],
  driverEntryId: string | null,
  campQuestion: FormQuestion | null,
) {
  const linkedFields: Array<Record<string, unknown>> = [];
  const linkedIds = new Set<string>();

  // A conditional follow-up text box named "아이디 입력" receives the same
  // driver ID that is already entered in the primary "기사님 아이디" field.
  if (driverEntryId) {
    for (const question of questions) {
      const label = normalizeQuestionLabel(question.label);
      if (!question.required ||
        question.entry_id === driverEntryId ||
        !/^아이디입력$/.test(label)) continue;

      linkedFields.push({
        entry_id: question.entry_id,
        source: "driver_id",
      });
      linkedIds.add(question.entry_id);
    }
  }

  // A second "요청 모바일 캠프" field can appear after the first choice.
  // Convert the short selected value to its matching descriptive child value.
  if (campQuestion && campQuestion.choices.length > 0) {
    const childQuestions = questions.filter((question) =>
      question.required &&
      question.entry_id !== campQuestion.entry_id &&
      /요청모바일캠프/.test(normalizeQuestionLabel(question.label)) &&
      question.choices.length > 0
    );

    for (const question of childQuestions) {
      const valueMap: Record<string, string> = {};
      let complete = true;
      for (const parentChoice of campQuestion.choices) {
        const parentKey = normalizeQuestionLabel(parentChoice);
        const matches = question.choices.filter((childChoice) =>
          normalizeQuestionLabel(childChoice).includes(parentKey)
        );
        if (matches.length !== 1) {
          complete = false;
          break;
        }
        valueMap[parentChoice] = matches[0];
      }

      if (complete && Object.keys(valueMap).length === campQuestion.choices.length) {
        linkedFields.push({
          entry_id: question.entry_id,
          source: "camp_choice",
          parent_entry_id: campQuestion.entry_id,
          value_map: valueMap,
        });
        linkedIds.add(question.entry_id);
      }
    }
  }

  return linkedFields;
}

function suggestMapping(questions: FormQuestion[]) {
  const invoice = chooseByPriority(questions, [
    (question) => /운송장번호/.test(normalizeQuestionLabel(question.label)),
    (question) => /송장번호|택배번호/.test(normalizeQuestionLabel(question.label)),
    (question) => /주문번호/.test(normalizeQuestionLabel(question.label)),
  ]);
  const driver = chooseByPriority(questions, [
    (question) => /^(기사님|기사)아이디$/.test(normalizeQuestionLabel(question.label)),
    (question) => /^(기사님|기사)아이디/.test(normalizeQuestionLabel(question.label)),
    (question) => /(기사님|기사).*아이디/.test(normalizeQuestionLabel(question.label)),
    (question) => /아이디/.test(normalizeQuestionLabel(question.label)),
  ]);
  const quantity = chooseByPriority(questions, [
    (question) => /채번수량/.test(normalizeQuestionLabel(question.label)),
    (question) => /수량/.test(normalizeQuestionLabel(question.label)),
  ]);
  const campQuestion = chooseCampDestinationQuestion(questions);
  const camp = campQuestion?.entry_id ?? null;
  const linkedFields = buildLinkedFields(questions, driver, campQuestion);
  const mappedIds = new Set([
    invoice,
    driver,
    quantity,
    camp,
    ...linkedFields.map((field) => String(field.entry_id)),
  ].filter(Boolean));

  const staticFields = questions
    .filter((question) => question.required && !mappedIds.has(question.entry_id))
    .flatMap((question) => {
      const choices = question.choices.map((choice) => choice.trim()).filter(Boolean);
      const fixedRequestChoice = choices.find((choice) =>
        /채번\s*요청/.test(choice)
      );
      const value = fixedRequestChoice ??
        (choices.length === 1 ? choices[0] : null);
      return value
        ? [{ entry_id: question.entry_id, value }]
        : [];
    });

  return {
    invoice_entry_id: invoice,
    driver_id_entry_id: driver,
    quantity_entry_id: quantity,
    camp_entry_id: camp,
    static_fields: staticFields,
    linked_fields: linkedFields,
  };
}
function getFormTitle(html: string): string {
  const headingMatch = html.match(
    /role="heading"[^>]*aria-level="1"[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (headingMatch) {
    const heading = stripHtml(headingMatch[1]);
    if (heading) return heading;
  }

  const ogTitleMatch = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (ogTitleMatch) {
    const title = stripHtml(ogTitleMatch[1]);
    if (title) return title;
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? stripHtml(titleMatch[1]) : "";
}

function normalizeCampText(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, "").replace(/[()（）]/g, "");
}

function inferCampName(
  title: string,
  questions: FormQuestion[],
): { campName: string; source: "title" | "choice" | "none" } {
  const normalizedTitle = String(title || "").trim();

  // The camp before "반품" identifies the owner/camp of this form.
  // It is separate from the destination choices in the "요청 캠프" question.
  const titlePrefixMatch = normalizedTitle.match(
    /^\s*([A-Za-z가-힣0-9_-]{2,30}캠프)\s*반품/i,
  );
  if (titlePrefixMatch?.[1]) {
    return { campName: titlePrefixMatch[1].trim(), source: "title" };
  }

  const titleCandidates = Array.from(new Set(
    (normalizedTitle.match(/[A-Za-z가-힣0-9_-]{2,30}캠프/g) || [])
      .map(value => value.trim())
      .filter(Boolean),
  ));

  // Use the options of a camp-related question as a fallback only when they
  // resolve to one distinct value. Mobile-camp options often look like
  // "학천MB" or "농소MB" and do not necessarily contain the word "캠프".
  const campChoiceCandidates = Array.from(new Set(
    questions
      .filter(question => /(요청\s*캠프|캠프명|캠프|거점)/i.test(question.label))
      .flatMap(question => question.choices)
      .map(value => value.trim())
      .filter(Boolean),
  ));

  // A single explicit camp name in the form title takes precedence over the
  // selectable destinations. Those values are handled separately by the app.
  if (titleCandidates.length === 1) {
    return { campName: titleCandidates[0], source: "title" };
  }

  if (titleCandidates.length === 0 && campChoiceCandidates.length === 1) {
    return { campName: campChoiceCandidates[0], source: "choice" };
  }

  return { campName: "", source: "none" };
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
  if (!supabaseUrl || !anonKey) {
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

  let formUrl = "";
  let campName = "";
  let formId: string | null = null;

  try {
    const body = await request.json();
    formUrl = String(body?.formUrl ?? "").trim();
    campName = String(body?.campName ?? "").trim();

    if (campName.length > 80) {
      throw new Error("캠프명은 80자 이내로 입력해주세요.");
    }

    const fetched = await fetchGoogleFormsPage(formUrl);
    formId = fetched.formId;
    const normalizedUrl = fetched.url;
    const response = fetched.response;

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
    const inferredCamp = inferCampName(title, questions);
    // A clear camp name immediately before "반품" in the form title is the
    // source of truth. A caller-supplied value must not override that title.
    if (inferredCamp.source === "title" || !campName) {
      campName = inferredCamp.campName;
    }

    const isCampQuestion = (question: FormQuestion) =>
      isCampRelatedQuestion(question) && question.choices.length > 0;
    const hasCampRelatedQuestion = questions.some(isCampRelatedQuestion);
    const linkedFields = Array.isArray(mapping.linked_fields) ? mapping.linked_fields : [];
    const mappedIds = new Set([
      mapping.invoice_entry_id,
      mapping.driver_id_entry_id,
      mapping.quantity_entry_id,
      mapping.camp_entry_id,
      ...mapping.static_fields.map((field) => field.entry_id),
      ...linkedFields.map((field) => String(field.entry_id)),
    ].filter(Boolean));
    const selectedCampQuestion = questions.find(
      (question) =>
        question.entry_id === mapping.camp_entry_id &&
        isCampQuestion(question),
    );
    const campMappingIsValid = !hasCampRelatedQuestion ||
      Boolean(selectedCampQuestion);
    const unresolvedRequiredQuestions = questions.filter(
      (question) => question.required && !mappedIds.has(question.entry_id),
    );
    const ready = Boolean(
      campName &&
      mapping.invoice_entry_id &&
      mapping.driver_id_entry_id &&
      mapping.quantity_entry_id &&
      campMappingIsValid &&
      unresolvedRequiredQuestions.length === 0
    );

    return jsonResponse({
      success: true,
      form_id: formId,
      form_url: normalizedUrl,
      title,
      suggested_camp_name: campName || inferredCamp.campName,
      camp_name_source: inferredCamp.source,
      questions,
      suggested_mapping: mapping,
      status: ready ? "ready" : "needs_mapping",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "양식 분석 중 알 수 없는 오류가 발생했습니다.";
    console.error("[analyze-camp-return-form]", message);
    return jsonResponse({ success: false, error: message }, 400);
  }
});
