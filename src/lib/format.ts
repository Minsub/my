export const money = (n: number | null | undefined) =>
  n == null ? "가격 미입력" : new Intl.NumberFormat("ko-KR").format(n) + "원";
export const kgPrice = (price: number | null, weight: number | null) =>
  price == null || !weight || weight <= 0
    ? null
    : Math.round((price * 1000) / weight);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function dateLabel(date: string | null) {
  if (!date) return "날짜 미상";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.replaceAll("-", ".");
  const instant = new Date(date);
  if (Number.isNaN(instant.getTime())) return "날짜 미상";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(instant)
    .replaceAll("-", ".");
}
export const vintageLabel = (wine: {
  vintage_kind: string;
  vintage: number | null;
}) =>
  wine.vintage_kind === "non_vintage"
    ? "NV"
    : wine.vintage
      ? String(wine.vintage)
      : "빈티지 미입력";
