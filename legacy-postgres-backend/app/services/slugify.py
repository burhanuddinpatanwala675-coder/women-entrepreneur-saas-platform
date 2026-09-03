import re
import uuid

from slugify import slugify as _slugify
from sqlalchemy.orm import Session


def slugify(text: str) -> str:
    return _slugify(text)


def unique_slug(db: Session, model, base_text: str, extra_filter=None) -> str:
    """Generate a unique slug for `model.slug`, scoped by an optional extra filter
    (e.g. business_id for per-business product slugs)."""
    base = slugify(base_text) or "item"
    candidate = base
    i = 1
    while True:
        query = db.query(model).filter(model.slug == candidate)
        if extra_filter is not None:
            query = query.filter(extra_filter)
        if not query.first():
            return candidate
        i += 1
        candidate = f"{base}-{i}"
