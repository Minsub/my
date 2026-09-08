export type Role = "owner" | "member";
export type Scope = "coffee:read" | "coffee:write" | "wine:read" | "wine:write";
export type Actor = {
  userId: string;
  householdId: string;
  role: Role;
  scopes: Scope[];
  channel: "web" | "mcp";
  clientId?: string;
};
export type Brand = {
  id: string;
  name: string;
  url: string;
  description: string;
  version: number;
  created_by: string | null;
};
export type Bean = {
  id: string;
  brand_id: string;
  name: string;
  product_url: string;
  image_url: string | null;
  roast: string | null;
  flavor: string;
  price: number | null;
  weight_g: number | null;
  version: number;
  created_by: string | null;
  archived: boolean;
};
export type Preference = {
  id: string;
  bean_id: string;
  user_id: string;
  status: string | null;
  recommendation: string | null;
  note: string;
  version: number;
};
export type Machine = { id: string; name: string };
export type Brew = {
  id: string;
  bean_id: string;
  user_id: string;
  machine_id: string;
  grind: number;
  dose: number;
  note: string;
  created_at: string;
};
export type Wine = {
  reference_price?: number | null;
  reference_purchased_on?: string | null;
  has_photo?: boolean;
  id: string;
  display_id: number;
  name: string;
  english_name: string;
  producer: string;
  type: string;
  country: string;
  region: string;
  grapes: string;
  vintage_kind: string;
  vintage: number | null;
  volume_ml: number | null;
  stock: number;
  version: number;
  archived: boolean;
  created_by: string | null;
};
export type StockEvent = {
  purchase_id?: string | null;
  id: string;
  wine_id: string;
  kind: string;
  delta: number;
  occurred_on: string;
  created_at: string;
  created_by: string;
  reason: string;
  reverses_id: string | null;
};
export type Purchase = {
  id: string;
  wine_id: string;
  quantity: number;
  unit_price: number | null;
  purchased_on: string;
  store: string;
};
export type Tasting = {
  id: string;
  wine_id: string;
  user_id: string;
  tasted_on: string | null;
  score: number | null;
  note: string;
  repurchase: boolean | null;
  event_id: string | null;
};
export type Glass = {
  id: string;
  name: string;
  brand: string;
  type: string;
  note: string;
  version: number;
  created_by: string | null;
};
export type Member = {
  user_id: string;
  name: string;
  role: Role;
  active: boolean;
};
export type Invite = { id: string; email: string; role: Role; active: boolean };
export type Activity = {
  id: string;
  operation: string;
  user_id: string;
  channel: string;
  created_at: string;
  label: string;
};
export type Snapshot = {
  household: { id: string; name: string };
  user: { id: string; name: string; role: Role };
  brands: Brand[];
  beans: Bean[];
  preferences: Preference[];
  machines: Machine[];
  brews: Brew[];
  wines: Wine[];
  events: StockEvent[];
  purchases: Purchase[];
  tastings: Tasting[];
  glasses: Glass[];
  members: Member[];
  invites: Invite[];
  activities: Activity[];
};
export const allScopes: Scope[] = [
  "coffee:read",
  "coffee:write",
  "wine:read",
  "wine:write",
];
export const roastOptions = ["약배전", "중배전", "강배전"];
export const wineTypes = [
  "레드",
  "화이트",
  "로제",
  "스파클링",
  "디저트",
  "주정강화",
];
export const glassTypes = [
  "보르도형",
  "부르고뉴형",
  "유니버설",
  "화이트와인형",
  "샴페인 플루트",
  "샴페인 쿠페",
  "디저트/포트",
  "리델-쉬라",
  "리델-샴페인&리슬링",
  "리델-사케",
];
