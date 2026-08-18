const VARIABLE_RE = /#\{([^}]+)\}/g;

/** 본문에서 #{키} 변수명을 중복 제거하여 수집한다. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(VARIABLE_RE)) {
    found.add(match[1].trim());
  }
  return [...found];
}

/** 알려진 변수를 치환한다. 미정의 변수는 원문(#{키})을 유지한다. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(VARIABLE_RE, (whole, keyRaw) => {
    const key = String(keyRaw).trim();
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole;
  });
}
