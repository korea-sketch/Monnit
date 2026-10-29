/* ============================================================
   Worker 번들용 빈 모듈 — pdf-lib · fontkit 대신 들어갑니다 (wrangler.toml [alias])
   ------------------------------------------------------------
   맞춤 제안서 PDF 는 GitHub Actions 가 만듭니다(wrangler.toml PDF_BUILDER = "github").
   그래서 Worker 에는 PDF 조판 라이브러리(약 1.6MB)를 싣지 않습니다 — 시작이 빨라지고 CPU 를 덜 씁니다.
   GitHub Actions(cloudflare/actions/build-proposal.mjs)는 Node 로 원본을 직접 실행하므로 진짜 라이브러리를 씁니다.
   이 함수들이 호출됐다면 PDF_BUILDER 가 "github" 가 아니라는 뜻입니다.
   ============================================================ */
const off = () => { throw new Error('Worker 에서는 PDF 를 만들지 않습니다 — wrangler.toml 의 PDF_BUILDER 를 "github" 로 두세요'); };
export const PDFDocument = { create: off, load: off };
export const rgb = off;
export const create = off;
export default { create: off };
