import { seedBrands, seedBeans } from "./seed-data";
import type { Snapshot } from "./types";
const uid = "demo-owner";
export function demoSnapshot(): Snapshot {
  const brands = seedBrands.map((b, i) => ({
    id: `brand-${i}`,
    name: b.name,
    url: b.url,
    description: "",
    version: 1,
    created_by: uid,
  }));
  const beans = seedBeans.map((b, i) => ({
    id: `bean-${i}`,
    brand_id: brands.find((x) => x.name === b.brand)!.id,
    name: b.name,
    product_url: b.url,
    image_url: null,
    roast: null,
    flavor: "",
    price: null,
    weight_g: null,
    version: 1,
    created_by: uid,
    archived: false,
  }));
  return {
    household: { id: "demo", name: "우리 집" },
    user: { id: uid, name: "나", role: "owner" },
    brands,
    beans,
    preferences: seedBeans.flatMap((b, i) =>
      b.recommendation
        ? [
            {
              id: `pref-${i}`,
              bean_id: `bean-${i}`,
              user_id: uid,
              status: null,
              recommendation: b.recommendation,
              note: b.note,
              version: 1,
            },
          ]
        : [],
    ),
    machines: [{ id: "machine-0", name: "우리 집 커피 머신" }],
    brews: seedBeans.flatMap((b, i) =>
      b.grind !== null
        ? [
            {
              id: `brew-${i}`,
              bean_id: `bean-${i}`,
              user_id: uid,
              machine_id: "machine-0",
              grind: b.grind,
              dose: b.dose!,
              note: "기기 설정값",
              created_at: "2026-09-08T00:00:00.000Z",
            },
          ]
        : [],
    ),
    wines: [],
    events: [],
    purchases: [],
    tastings: [],
    glasses: [],
    members: [{ user_id: uid, name: "나", role: "owner", active: true }],
    invites: [],
    activities: [],
  };
}
