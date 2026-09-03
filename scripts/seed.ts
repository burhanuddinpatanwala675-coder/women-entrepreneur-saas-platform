/**
 * One-off bootstrap script — the Firebase equivalent of the old
 * `python -m app.seed.seed_categories`. Seeds the default category tree and the public
 * `config/ai` doc the frontend reads to show the AI Assistant's configured/not-configured
 * state.
 *
 * This is a PLAIN NODE SCRIPT run on your own machine with the Admin SDK — not a Cloud
 * Function. The Admin SDK bypasses Security Rules by design, which is exactly what
 * seeding needs, and running it locally costs nothing and needs no Blaze plan (that
 * requirement only applies to *deploying* Cloud Functions, which this build doesn't do —
 * see ARCHITECTURE.md's migration note).
 *
 * Run once per environment, from this `scripts/` directory:
 *
 *   npm install
 *   npx firebase emulators:exec --project demo-hercommerce "npm run seed"   # emulator
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed      # real project
 *
 * (A service account JSON comes from Firebase Console -> Project settings -> Service
 * accounts -> Generate new private key. Keep it out of git — it's already covered by the
 * root .gitignore's *.json service-account patterns; double check before committing.)
 *
 * Safe to re-run — it skips any category slug that already exists.
 */
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const CATEGORY_TREE: [string, string, string, string[]][] = [
  ["Fashion", "fashion", "👗", ["Lawn Suits", "Designer Suits", "Night Suits", "Abayas", "Women's Clothing", "Kids Clothing"]],
  ["Beauty & Organic", "beauty-organic", "🧴", ["Organic Soaps", "Skincare", "Haircare", "Natural Beauty Products"]],
  ["Handmade", "handmade", "🕯️", ["Organic Candles", "Handmade Gifts", "Crafts"]],
  ["Jewellery & Accessories", "jewellery-accessories", "💍", ["Artificial Jewellery", "Handmade Jewellery", "Bags", "Accessories"]],
  ["Food & Bakery", "food-bakery", "🍰", ["Cakes", "Cupcakes", "Homemade Food", "Catering"]],
  ["Home & Living", "home-living", "🏡", ["Bedsheets", "Cushions", "Home Decor", "Handmade Home Products"]],
  ["Gifts", "gifts", "🎁", ["Customized Gifts", "Gift Baskets", "Personalized Products"]],
  ["Services", "services", "🧑‍🏫", ["Tutors", "Designers", "Consultants", "Freelancers"]],
  ["Digital Products", "digital-products", "💻", ["Templates", "Courses", "Downloads"]],
];

function slugifySimple(s: string): string {
  return s.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-").replace(/'/g, "");
}

async function seedCategories() {
  const existingSnap = await db.collection("categories").get();
  const existing = new Set(existingSnap.docs.map((d) => d.data().slug as string));

  let order = 0;
  for (const [name, slug, icon, children] of CATEGORY_TREE) {
    order += 1;
    let parentId: string;
    if (existing.has(slug)) {
      parentId = existingSnap.docs.find((d) => d.data().slug === slug)!.id;
    } else {
      const ref = await db.collection("categories").add({
        name,
        slug,
        icon,
        parentId: null,
        isActive: true,
        sortOrder: order,
      });
      parentId = ref.id;
    }

    let childOrder = 0;
    for (const childName of children) {
      childOrder += 1;
      const childSlug = `${slug}-${slugifySimple(childName)}`;
      if (existing.has(childSlug)) continue;
      await db.collection("categories").add({
        name: childName,
        slug: childSlug,
        icon: null,
        parentId,
        isActive: true,
        sortOrder: childOrder,
      });
    }
  }
  console.log("Categories seeded.");
}

async function seedAiConfig() {
  await db.collection("config").doc("ai").set({ configured: false, provider: "none" }, { merge: true });
  console.log("config/ai seeded (configured: false — update this once a real AI provider is wired up).");
}

async function run() {
  await seedCategories();
  await seedAiConfig();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
