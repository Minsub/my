import * as XLSX from "xlsx";
export function cashWorkbook(expense = 12000) {
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      "기간",
      "자산",
      "분류",
      "소분류",
      "내용",
      "KRW",
      "수입/지출",
      "추가입력",
      "금액",
      "화폐",
      "자산",
    ],
    [
      "2026-01-01",
      "은행",
      "급여",
      "",
      "월급",
      100000,
      "수입",
      "",
      100000,
      "KRW",
      "",
    ],
    [
      "2026-01-12",
      "카드",
      "식비",
      "식사",
      "점심",
      expense,
      "지출",
      "",
      expense,
      "KRW",
      "",
    ],
    [
      "2026-01-13",
      "카드",
      "식비",
      "식사",
      "환불",
      -2000,
      "지출",
      "",
      -2000,
      "KRW",
      "",
    ],
    [
      "2026-03-01",
      "카드",
      "여행",
      "",
      "외화 결제",
      9000,
      "지출",
      "",
      10,
      "NZD",
      "",
    ],
    [
      "2026-03-02",
      "은행",
      "이동",
      "",
      "계좌 이동",
      50000,
      "이체출금",
      "",
      50000,
      "KRW",
      "",
    ],
    [
      "2026-03-03",
      "은행",
      "선물",
      "계좌이체",
      "가족 이체",
      30000,
      "지출",
      "",
      30000,
      "KRW",
      "",
    ],
    ["2026-03-04", "카드", "기타", "", "=TEST()", 0, "지출", "", 0, "KRW", ""],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "내역");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function cashHistoryWorkbook() {
  const data: (string | number)[][] = [
    [
      "기간",
      "자산",
      "분류",
      "소분류",
      "내용",
      "KRW",
      "수입/지출",
      "금액",
      "화폐",
    ],
  ];
  const categories = [
    "식비",
    "주거·생활",
    "교통",
    "여행",
    "문화·취미",
    "건강",
    "생활용품과 정기 구독 서비스",
  ];
  for (let year = 2021; year <= 2026; year++) {
    for (let month = 1; month <= (year === 2026 ? 6 : 12); month++) {
      const date = `${year}-${String(month).padStart(2, "0")}-15`;
      data.push([
        date,
        "은행",
        "급여",
        "",
        "급여",
        6000000 + (year - 2021) * 300000,
        "수입",
        6000000 + (year - 2021) * 300000,
        "KRW",
      ]);
      categories.forEach((cat, i) => {
        const amount = Math.round(
          (i + 1) *
            73000 *
            (1 + (year - 2021) * 0.07) *
            (1 + Math.sin(month + i) * 0.25),
        );
        data.push([
          date,
          "카드",
          cat,
          i % 2 ? "정기" : "일상",
          `합성 ${cat} 기록`,
          amount,
          "지출",
          amount,
          "KRW",
        ]);
      });
    }
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data), "내역");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
