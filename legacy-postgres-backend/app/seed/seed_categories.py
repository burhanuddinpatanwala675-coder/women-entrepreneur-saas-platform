"""Seed the default category tree (flexible: admins can add more via the admin API)."""
from app.db.session import SessionLocal
from app.models.category import Category

CATEGORY_TREE = [
    ("Fashion", "fashion", "👗", [
        "Lawn Suits", "Designer Suits", "Night Suits", "Abayas", "Women's Clothing", "Kids Clothing",
    ]),
    ("Beauty & Organic", "beauty-organic", "🧴", [
        "Organic Soaps", "Skincare", "Haircare", "Natural Beauty Products",
    ]),
    ("Handmade", "handmade", "🕯️", [
        "Organic Candles", "Handmade Gifts", "Crafts",
    ]),
    ("Jewellery & Accessories", "jewellery-accessories", "💍", [
        "Artificial Jewellery", "Handmade Jewellery", "Bags", "Accessories",
    ]),
    ("Food & Bakery", "food-bakery", "🍰", [
        "Cakes", "Cupcakes", "Homemade Food", "Catering",
    ]),
    ("Home & Living", "home-living", "🏡", [
        "Bedsheets", "Cushions", "Home Decor", "Handmade Home Products",
    ]),
    ("Gifts", "gifts", "🎁", [
        "Customized Gifts", "Gift Baskets", "Personalized Products",
    ]),
    ("Services", "services", "🧑‍🏫", [
        "Tutors", "Designers", "Consultants", "Freelancers",
    ]),
    ("Digital Products", "digital-products", "💻", [
        "Templates", "Courses", "Downloads",
    ]),
]


def slugify_simple(s: str) -> str:
    return s.lower().replace(" & ", "-").replace(" ", "-").replace("'", "")


def run():
    db = SessionLocal()
    try:
        existing = {c.slug for c in db.query(Category).all()}
        order = 0
        for name, slug, icon, children in CATEGORY_TREE:
            order += 1
            if slug in existing:
                parent = db.query(Category).filter(Category.slug == slug).first()
            else:
                parent = Category(name=name, slug=slug, icon=icon, sort_order=order)
                db.add(parent)
                db.flush()
            child_order = 0
            for child_name in children:
                child_order += 1
                child_slug = f"{slug}-{slugify_simple(child_name)}"
                if child_slug in existing:
                    continue
                db.add(Category(
                    name=child_name, slug=child_slug, icon=None,
                    parent_id=parent.id, sort_order=child_order,
                ))
        db.commit()
        print("Categories seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
