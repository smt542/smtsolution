/**
 * 고객번호 집계표의 행은 건물 상세(부가정보)에 등록된 고객번호만이다(정책 3.3).
 * 호실은 계량기 고객번호가 일치하는 등록 번호에 묶고, 등록 번호가 하나뿐이면
 * 계량기 고객번호가 비어 있는 호실도 그 번호에 묶는다(list_utility_rows 단가 해석과 동일).
 * 등록되지 않은 호실 고객번호는 집계 행을 만들지 않는다.
 */
export function groupRowsByRegisteredCustomer<T extends { customerNumber: string | null }>(
  rows: T[],
  registered: string[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  registered.forEach((customerNumber) => {
    if (!groups.has(customerNumber)) groups.set(customerNumber, []);
  });
  const soleCustomer = groups.size === 1 ? [...groups.keys()][0] : null;
  rows.forEach((row) => {
    const own = row.customerNumber?.trim() ?? "";
    const key = own ? own : soleCustomer;
    const group = key === null ? undefined : groups.get(key);
    if (group) group.push(row);
  });
  return groups;
}

/**
 * 호실 → 라인 번호. 라인은 고객번호 집계표의 L(등록 고객번호 정렬순 1부터)과 같아서
 * 같은 고객번호에 묶인 호실은 같은 라인 번호를 갖는다. 어느 등록 번호에도 묶이지 않은 호실은 빠진다.
 */
export function lineNumbersByUnit<T extends { unitId: number; customerNumber: string | null }>(
  rows: T[],
  registered: string[],
): Map<number, number> {
  const lines = new Map<number, number>();
  [...groupRowsByRegisteredCustomer(rows, registered).values()].forEach((group, index) => {
    group.forEach((row) => lines.set(row.unitId, index + 1));
  });
  return lines;
}
