import { commandGuide, readGuide, photoGuide } from "@/lib/mcp-guide";
const groups = [
  {
    title: "와인 조회와 추천",
    scope: "wine:read · 와인 조회",
    entries: Object.entries(readGuide).filter(([id]) => id.startsWith("wine_")),
  },
  {
    title: "와인 등록과 기록",
    scope: "wine:write · 와인 기록",
    entries: Object.entries(commandGuide).filter(([id]) =>
      id.startsWith("wine_"),
    ),
  },
  {
    title: "와인 사진",
    scope: "wine:write · 와인 사진 등록",
    entries: Object.entries(photoGuide),
  },
  {
    title: "커피 조회",
    scope: "coffee:read · 커피 조회",
    entries: Object.entries(readGuide).filter(([id]) =>
      id.startsWith("coffee_"),
    ),
  },
  {
    title: "커피 등록과 기록",
    scope: "coffee:write · 커피 기록",
    entries: Object.entries(commandGuide).filter(([id]) =>
      id.startsWith("coffee_"),
    ),
  },
  {
    title: "가족 요약",
    scope: "허용한 조회 권한에 따라 결과 제공",
    entries: Object.entries(readGuide).filter(([id]) =>
      id.startsWith("household_"),
    ),
  },
];
export function McpGuide() {
  return (
    <div className="mcp-guide">
      <h3>MCP로 무엇을 할 수 있나요?</h3>
      <p>
        AI에게 평소 말하듯 부탁하면, AI가 필요한 도구를 골라 우리 가족의 기록을
        조회하거나 저장합니다. 조회는 연결 시 허용한 범위에서, 변경은 기록
        권한과 항목별 수정 권한 안에서 이루어집니다.
      </p>
      <div className="mcp-examples">
        <blockquote>
          “재고 있는 5만원 이하 화이트 와인을 구입일순으로 보여줘.”
        </blockquote>
        <blockquote>
          “이 와인 두 병을 병당 35,000원에 샀어. 입고해줘.”
        </blockquote>
        <blockquote>
          “이 원두에 대한 가족 평가와 추출 설정을 알려줘.”
        </blockquote>
      </div>
      <details className="mcp-photo-guide" open>
        <summary>첨부한 사진은 어디에 저장되나요?</summary>
        <ol>
          <li>
            <strong>AI에 첨부:</strong> Claude 등에 올린 사진은 해당 AI
            서비스에서 관리합니다. 첨부만으로 우리 앱에 저장되지는 않습니다.
          </li>
          <li>
            <strong>MCP로 전달:</strong> AI가 실제 사진 파일을 읽을 수 있을 때
            파일 내용을 base64 문자열로 바꿔 <code>wine_upload_photo</code>에
            전달합니다. 사진을 이해할 수 있어도 파일 전송은 지원하지 않을 수
            있습니다.
          </li>
          <li>
            <strong>우리 앱에 저장:</strong> 서버가 전달받은 사진을
            검증·축소하고 위치정보를 제거한 뒤, Neon DB에 압축된 이미지 파일을
            별도로 저장합니다. Claude의 이미지 링크를 저장하거나 그 링크에서
            자동 다운로드하는 방식이 아닙니다.
          </li>
          <li>
            <strong>가족에게 표시:</strong> 우리 앱의 인증된 사진 주소로
            표시합니다. 저장 완료된 사본은 Claude 대화나 첨부 링크에 의존하지
            않으며, 양쪽 사진 삭제도 자동 연동되지 않습니다.
          </li>
        </ol>
        <p>
          파일 전달이 어려우면 <code>wine_photo_upload_link</code>로 링크를 받아
          로그인 후 직접 올려주세요. 가장 확실한 방법은 웹의 와인 상세 → 사진
          업로드입니다. 웹은 20MB 이하 JPEG·PNG·WebP를 받아 먼저 축소하고, MCP
          직접 전송은 약 2MB 이하 파일을 받습니다. HEIC는 JPEG로 변환해주세요.
        </p>
        <p>
          이 설명은 <strong>와인 대표 사진</strong> 기준입니다. 원두의{" "}
          <code>image_url</code>은 외부 HTTPS 사진 주소를 저장하는 방식입니다.
        </p>
      </details>
      <details className="mcp-rules">
        <summary>권한과 도구 호출의 공통 규칙</summary>
        <ul>
          <li>
            가족 계정으로 OAuth 로그인하고 커피/와인의 조회·기록 권한을
            선택합니다. 실제 도구 목록은 연결에 허용된 권한에 따라 달라집니다.
          </li>
          <li>
            입고와 소비는 재고를 실제로 바꿉니다. 상품·사진 등의 수정은 등록자
            또는 관리자 권한이 필요하고, 평가는 연결한 본인 계정으로 남습니다.
          </li>
          <li>
            변경 요청의 <code>idempotency_key</code>는 작업별 UUID입니다. 같은
            작업의 통신 재시도에는 같은 키와 같은 입력을 사용해 중복 저장을
            막습니다.
          </li>
          <li>
            <code>expected_version</code>은 최근 조회한 항목의 버전입니다. 수정
            시 유지할 기존 필드도 함께 전달합니다. 충돌하면 다시 조회한 뒤
            변경을 적용합니다.
          </li>
          <li>
            날짜는 YYYY-MM-DD, 가격은 원 단위입니다. 목록은 기본 30개, 최대
            100개이며 <code>next_cursor</code>가 있으면 다음 페이지를
            조회합니다. ID는 표시 번호가 아닌 UUID입니다.
          </li>
          <li>
            가족 초대·접근 해제·보관 처리는 현재 MCP 도구로 제공하지 않습니다.
            웹에서 관리해주세요. AI 연결을 해제해도 이미 저장한 가족 기록은
            남습니다.
          </li>
        </ul>
        <p>
          MCP 주소는 <code>/api/mcp</code> 하나이며, 아래 이름들은 그 주소를
          통해 호출하는 도구입니다. 도구마다 별도의 REST 주소가 있는 것은
          아닙니다.
        </p>
      </details>
      <h3>도구별 사용 안내 · 25개</h3>
      <p className="muted small">
        그룹을 펼친 뒤 도구를 선택하면 입력값·결과·요청 예시를 볼 수 있어요.
        모든 값을 직접 입력할 필요는 없고 AI가 도구 호출에 사용합니다.
      </p>
      <div className="mcp-tool-groups">
        {groups.map((group) => (
          <details key={group.title} className="mcp-tool-group">
            <summary>
              {group.title}
              <span>{group.entries.length}개</span>
            </summary>
            <p className="muted small">{group.scope}</p>
            {group.entries.map(([id, entry]) => (
              <details key={id} className="mcp-tool">
                <summary>
                  <strong>{entry.title}</strong>
                  <code>{id}</code>
                </summary>
                <p>{entry.description}</p>
                <dl>
                  <dt>입력</dt>
                  <dd>{entry.input}</dd>
                  <dt>결과</dt>
                  <dd>{entry.result}</dd>
                  <dt>이렇게 요청해보세요</dt>
                  <dd>“{entry.example}”</dd>
                </dl>
              </details>
            ))}
          </details>
        ))}
      </div>
    </div>
  );
}
