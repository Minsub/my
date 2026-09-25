# 사진 저장 방식과 전환 기준

2026-09-25 기준. 지금은 모든 사진을 Neon PostgreSQL의 bytea로 저장한다. 당장은 바꾸지 않는다. 이 문서는 새 페이지에 사진 업로드를 추가할 때 이 방식을 그대로 쓸지, 오브젝트 스토리지로 옮길지 판단하는 기준이다.

## 현재 방식

| 사용처 | 테이블 | 조회 경로 |
|---|---|---|
| 와인 사진 | `wine_photos` (와인당 1장) | `/api/wine/{id}/photo?v={version}` |
| 꼬미 출혈 사진 | `pregnancy_photos` (기록당 최대 4장) | `/api/baby/pregnancy/photo/{id}` |

- 업로드 경로는 모두 같다. 브라우저가 1200px JPEG로 줄여 보낸다. 서버는 `src/server/wine-photos.ts`의 `normalizePhoto`로 검증하고, 회전 보정 후 1000px WebP(q75)로 바꾼다. 결과가 300KB를 넘으면 거부한다(DB CHECK도 300KB).
- 원본과 EXIF/위치정보는 저장하지 않는다.
- 새 페이지에서 사진을 받을 때도 `normalizePhoto`를 재사용하고 같은 300KB 상한을 지킨다.
- 조회는 인증된 라우트만 거친다. 공개 URL은 없다.
- 브라우저 캐시는 `private, max-age=31536000, immutable`이다. 같은 주소의 내용이 바뀌지 않기 때문이다.
  - 와인은 사진을 바꾸면 version이 올라 주소가 바뀐다. `?v=` 없이 요청하면 `no-store`다.
  - 출혈 사진은 수정할 때 새 id로 저장한다.
  - 삭제한 사진이 이미 본 기기의 브라우저 캐시에 남을 수 있다. 공유 캐시(CDN)에는 남지 않는다.

## 측정값 (2026-09-25)

| 항목 | 값 |
|---|---|
| 운영 DB 전체 | 12 MB (가장 큰 표는 cash_files 약 1 MB) |
| 사진 | 와인 0장, 출혈 4장 138 KB (장당 약 35 KB) |
| Vercel 최근 30일 (Hobby) | Fast Data Transfer 65.6 MB / 100 GB, Edge Requests 6.3K / 1M, Function Invocations 4.9K / 1M, Blob 미사용 |

## 무료 한도 비교

| | Neon Free (현재) | Vercel Blob Hobby |
|---|---|---|
| 저장 | 프로젝트당 0.5 GB. DB 전체와 공유 | 1 GB |
| 전송 | 프로젝트당 월 5 GB (사진 조회 시 Neon→함수 전송 포함) | 월 10 GB + Vercel 공통 전송 |
| 요청 횟수 | 컴퓨트 월 100 CU-시간 | 읽기(Simple) 월 1만 회, 쓰기·목록(Advanced) 월 2천 회 |
| 초과 시 | 저장·컴퓨트 제한 | Hobby는 30일 정지 |
| 비공개 | 앱 라우트로만 제공 | 비공개 스토어 + 만료 서명 URL(최대 7일) |

한도는 조사 시점의 공개 문서 기준이다. 전환할 때 요금 페이지를 다시 확인한다.

## 지금 옮기지 않는 이유

- 1000px WebP 기준으로 0.5 GB에 수천 장 이상 들어간다. 현재 사용량과 예상 증가(출혈·와인 사진)로는 한도에 닿지 않는다.
- Blob으로 옮기면 DB 행과 Blob 파일의 정합성(삭제·고아 파일 정리), 두 곳의 백업, 로컬 개발용 토큰 관리가 새로 생긴다.
- Blob Hobby의 읽기 1만 회/월이 오히려 먼저 닿을 수 있다. 비공개 사진은 함수가 Blob에서 꺼내 전달하므로, 조회가 읽기 횟수로 잡힐 가능성이 크다.

## 전환을 검토할 신호

아래 중 하나가 생기면 이 문서를 다시 보고 결정한다.

1. 사진·영상이 주가 되는 페이지를 만들 때. 예: 꼬미 출산 후 아기 사진첩.
2. 원본 화질 보관이 필요할 때.
3. 운영 DB가 250~300 MB에 가까워질 때. 확인 쿼리: `SELECT pg_size_pretty(pg_database_size(current_database()))`.
4. Neon 월 전송량이 한도에 가까워질 때.

## 옮긴다면

- **Vercel Blob (비공개 스토어)**: 설정이 가장 적다. Vercel에서 스토어를 연결하면 `BLOB_READ_WRITE_TOKEN`이 설정된다. 1 GB 안의 사진 위주 기능에 맞다.
- **Cloudflare R2**: 저장 10 GB, 전송 무료, S3 API. 영상·원본·대량 사진이면 이쪽이 낫다. Cloudflare 계정, 키, S3 SDK가 필요하다.
- Cloudinary와 UploadThing은 제외했다. 가공 기능은 이미 서버에서 하고 있다. UploadThing 무료는 비공개 파일을 지원하지 않고, Cloudinary 무료의 서명 URL은 만료가 없다.

### 작업 순서 (Vercel Blob 기준)

1. 새 migration으로 사진 표에 `storage_key`를 추가하고 `content`를 nullable로 바꾼다. 적용된 migration은 수정하지 않는다.
2. `normalizePhoto` 결과를 비공개 Blob에 `put`하고 키만 DB에 저장한다. 목록용 200px 썸네일을 함께 저장해 읽기 횟수와 전송량을 줄인다.
3. 조회 라우트는 지금처럼 인증·공간 검사 후 Blob에서 읽어 전달한다. 또는 짧은 서명 URL로 이동시킨다. 캐시 헤더는 유지한다.
4. 기록·사진을 삭제할 때 Blob 파일도 지운다. 트랜잭션 커밋 뒤에 지우고, 실패하면 고아 파일 정리 작업으로 처리한다.
5. 기존 bytea를 Blob으로 옮기는 일회성 스크립트를 실행하고 `content`를 비운다.
6. `scripts/export.ts` 백업에 Blob 사진을 포함하는지 결정하고, [배포 문서](deployment.md)의 백업 항목을 갱신한다.

## 참고

- [Neon Free plan limits](https://neon.com/faqs/free-plan-limits-and-quotas)
- [Vercel Blob usage and pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Vercel Blob private storage](https://vercel.com/docs/vercel-blob/private-storage)
- [Cloudflare R2](https://www.cloudflare.com/products/r2/)
