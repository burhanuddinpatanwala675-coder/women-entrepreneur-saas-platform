from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.category import Category
from app.schemas.category import CategoryOut, CategoryTreeOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryTreeOut])
def list_categories(db: Session = Depends(get_db)):
    """Public: returns the top-level category tree used by the onboarding wizard and
    storefronts. New categories/subcategories can be added freely via the admin API —
    nothing here is hardcoded into the frontend."""
    top_level = (
        db.query(Category)
        .filter(Category.parent_id.is_(None), Category.is_active.is_(True))
        .order_by(Category.sort_order)
        .all()
    )
    result = []
    for cat in top_level:
        children = (
            db.query(Category)
            .filter(Category.parent_id == cat.id, Category.is_active.is_(True))
            .order_by(Category.sort_order)
            .all()
        )
        item = CategoryTreeOut(
            **CategoryOut.model_validate(cat).model_dump(),
            children=[CategoryOut.model_validate(c) for c in children],
        )
        result.append(item)
    return result
