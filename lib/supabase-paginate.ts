/**
 * PostgREST 기본 1,000행 상한 우회 — .range() 페이지네이션으로 전체 행을 수집한다.
 *
 * 배경: PostgREST(Supabase)는 명시적 상한이 없으면 쿼리당 최대 1,000행만 반환한다.
 * 집계(합계/고유 집합)를 JS에서 수행하는 라우트가 이를 우회하지 않으면, 병원·기간·전체합
 * 뷰가 1,000행을 넘는 순간 조용히 과소집계된다(매출·광고비·ROAS 등).
 *
 * 사용 규칙:
 * - 합계/집합이 필요한 경우에만 사용. 단순 개수는 `select('*', { count: 'exact', head: true })`가 더 저렴·정확.
 * - `makeQuery`는 매 페이지마다 쿼리를 새로 만들어 `.order(<고유컬럼>).range(from, to)`까지 적용해야 한다.
 *   정렬 컬럼은 반드시 고유(보통 PK `id`)여야 페이지 경계에서 누락·중복이 없다.
 * - 조회 실패 시 throw → 라우트 상위 try/catch에서 apiError로 표면화(오류를 빈 데이터로 위장 금지).
 */

type PageResult<T> = { data: T[] | null; error: unknown }

export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    // 안전 상한: 비정상 무한 루프 방지 (100만 행)
    if (all.length >= 1_000_000) break
  }
  return all
}

/**
 * fetchAllRows의 `{ data, error }` 래퍼 — 기존 라우트의 error 체크 패턴을 유지한 채 페이지네이션 적용.
 * try/catch가 없는 핸들러(withClinicFilter 등)에서 `if (res.error) return apiError(...)` 흐름을 그대로 쓰기 위함.
 */
export async function fetchAllRowsResult<T>(
  makeQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
): Promise<PageResult<T>> {
  try {
    return { data: await fetchAllRows(makeQuery, pageSize), error: null }
  } catch (error) {
    return { data: null, error }
  }
}
