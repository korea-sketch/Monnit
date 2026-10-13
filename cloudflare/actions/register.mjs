/* GitHub Actions 에서 netlify 함수 코드를 그대로 돌리기 위한 준비
   '@netlify/blobs' 를 R2 호환 모듈(Worker 의 /api/__blobs 경유)로 바꿔 끼웁니다. */
import { register } from 'node:module';
register('./alias-loader.mjs', import.meta.url);
