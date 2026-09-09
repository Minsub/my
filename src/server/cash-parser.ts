import * as XLSX from "xlsx";
import type { CashMeta, CashRow } from "@/lib/cash";
export const CASH_MAX_BYTES = 3000000;
export const CASH_MAX_ROWS = 50000;
export function cashFilename(value: string) {
  const name = value
    .normalize("NFC")
    .trim()
    .replace(/\.xlsx$/i, ".xlsx");
  if (
    !/^.{1,100}\.xlsx$/u.test(name) ||
    /[\\/\x00-\x1f\x7f]/.test(name) ||
    name.startsWith(".") ||
    name.startsWith("~$")
  )
    throw Error("파일 이름을 확인해주세요. .xlsx 파일만 사용할 수 있습니다.");
  return { name, key: name.toLocaleLowerCase("en-US") };
}
// Inspect ZIP central-directory sizes before SheetJS inflates XML; reject encrypted/ZIP64/oversized archives.
function checkZip(b: Buffer) {
  if (
    b.length < 22 ||
    b.length > CASH_MAX_BYTES ||
    b.readUInt32LE(0) !== 0x04034b50
  )
    throw Error("3MB 이하의 올바른 XLSX 파일이 필요합니다.");
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (
      b.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + b.readUInt16LE(i + 20) === b.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0) throw Error("엑셀 압축 구조가 올바르지 않습니다.");
  const count = b.readUInt16LE(end + 10);
  let offset = b.readUInt32LE(end + 16),
    expanded = 0;
  if (count > 2000 || count === 65535 || offset >= end)
    throw Error("엑셀 파일 구조가 너무 큽니다.");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || b.readUInt32LE(offset) !== 0x02014b50)
      throw Error("손상된 엑셀 파일입니다.");
    if (b.readUInt16LE(offset + 8) & 1)
      throw Error("암호화된 파일은 지원하지 않습니다.");
    expanded += b.readUInt32LE(offset + 24);
    if (expanded > 40000000)
      throw Error("압축 해제된 엑셀은 40MB 이하여야 합니다.");
    offset +=
      46 +
      b.readUInt16LE(offset + 28) +
      b.readUInt16LE(offset + 30) +
      b.readUInt16LE(offset + 32);
  }
}
function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw =
    typeof value === "string" ? value.trim().replace(/,/g, "") : value;
  if (raw === "" || !/^[-+]?\d+(\.\d+)?$/.test(String(raw))) return null;
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) <= 1e10 ? n : null;
}
function day(value: unknown, date1904: boolean) {
  let year: number, month: number, date: number;
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value, { date1904 });
    if (!d) throw Error("날짜 형식 오류");
    year = d.y;
    month = d.m;
    date = d.d;
  } else {
    const m = String(value).match(
      /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[ T])/,
    );
    if (!m) throw Error("날짜 형식 오류");
    year = +m[1];
    month = +m[2];
    date = +m[3];
  }
  const d = new Date(Date.UTC(year, month - 1, date));
  if (
    year < 1900 ||
    year > 2100 ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== date
  )
    throw Error("날짜 범위 오류");
  return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}
export function parseCashWorkbook(
  content: Buffer,
  filename: string,
): { rows: CashRow[]; metadata: CashMeta } {
  checkZip(content);
  const { name } = cashFilename(filename);
  const workbook = XLSX.read(content, {
    type: "buffer",
    cellDates: false,
    cellFormula: true,
    sheetRows: CASH_MAX_ROWS + 2,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw Error("시트가 없습니다.");
  const range = XLSX.utils.decode_range(
    sheet["!fullref"] || sheet["!ref"] || "A1",
  );
  if (range.e.r > CASH_MAX_ROWS || range.e.c > 100)
    throw Error("최대 50,000행, 101열까지 지원합니다.");
  const source = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (source.length > CASH_MAX_ROWS + 1)
    throw Error("파일당 최대 50,000행까지 지원합니다.");
  const header = source[0]?.map((x) => String(x ?? "").trim()) || [];
  for (const key of ["기간", "수입/지출", "분류", "내용", "KRW"])
    if (!header.includes(key)) throw Error(`필수 열이 없습니다: ${key}`);
  const rows: CashRow[] = [],
    errors: number[] = [];
  for (let i = 1; i < source.length; i++) {
    const row = source[i];
    if (row.every((x) => x === null || x === "")) continue;
    const get = (key: string) => row[header.indexOf(key)];
    try {
      const type = String(get("수입/지출") ?? "").trim();
      if (
        ![
          "수입",
          "지출",
          "이체입금",
          "이체출금",
          "차액수입",
          "차액지출",
        ].includes(type)
      )
        throw Error("종류 오류");
      // Do not execute or trust workbook formulas for required business fields.
      for (const key of ["기간", "수입/지출", "KRW", "금액"]) {
        const col = header.indexOf(key);
        if (col >= 0 && sheet[XLSX.utils.encode_cell({ r: i, c: col })]?.f)
          throw Error("수식은 지원하지 않습니다.");
      }
      const currency = String(get("화폐") ?? "KRW").trim() || "KRW";
      const originalAmount = number(get("금액"));
      const krw = number(get("KRW"));
      if (String(get("KRW") ?? "").trim() && krw === null)
        throw Error("원화 금액 오류");
      const amount = krw ?? (currency === "KRW" ? originalAmount : null);
      if (amount === null) throw Error("원화 금액 오류");
      const text = (key: string) =>
        String(get(key) ?? "")
          .trim()
          .slice(0, 2000);
      rows.push({
        id: String(i + 1),
        date: day(get("기간"), !!workbook.Workbook?.WBProps?.date1904),
        member: name.replace(/\.xlsx$/i, ""),
        type,
        category: text("분류") || "미분류",
        subCategory: text("소분류"),
        memo: text("내용"),
        asset: text("자산"),
        amount: Math.round(amount),
        currency,
        originalAmount,
      });
    } catch {
      errors.push(i + 1);
    }
  }
  if (errors.length)
    throw Error(
      `${errors.length}개 행의 날짜·금액·거래 유형을 확인해주세요 (행 ${errors.slice(0, 8).join(", ")}). 수식은 값으로 내보내주세요. 기존 파일은 유지됩니다.`,
    );
  if (!rows.length) throw Error("거래 내역이 없는 파일은 적용할 수 없습니다.");
  const dates = rows.map((r) => r.date).sort();
  const income = rows.filter((r) => r.type === "수입"),
    expense = rows.filter((r) => r.type === "지출");
  return {
    rows,
    metadata: {
      rows: rows.length,
      incomeRows: income.length,
      expenseRows: expense.length,
      otherRows: rows.length - income.length - expense.length,
      negativeRows: rows.filter((r) => r.amount < 0).length,
      zeroRows: rows.filter((r) => r.amount === 0).length,
      firstDate: dates[0],
      lastDate: dates.at(-1)!,
      income: income.reduce((n, r) => n + r.amount, 0),
      expense: expense.reduce((n, r) => n + r.amount, 0),
      sheets: workbook.SheetNames.length,
    },
  };
}
