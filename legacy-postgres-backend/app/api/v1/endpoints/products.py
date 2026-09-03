import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_current_business
from app.db.session import get_db
from app.models.business import Business
from app.models.product import Product, ProductStatus
from app.models.product_image import ProductImage
from app.models.product_variant import ProductVariant
from app.schemas.product import (
    ProductCreate,
    ProductOut,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantOut,
    ProductVariantUpdate,
)
from app.services.slugify import unique_slug
from app.services.stock import recompute_product_status as _recompute_status

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(
    status_filter: Optional[ProductStatus] = Query(None, alias="status"),
    search: Optional[str] = None,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Product)
        .options(joinedload(Product.images), joinedload(Product.variants))
        .filter(Product.business_id == business.id)
    )
    if status_filter:
        query = query.filter(Product.status == status_filter)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    return query.order_by(Product.created_at.desc()).all()


@router.post("", response_model=ProductOut, status_code=201)
def create_product(payload: ProductCreate, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    slug = unique_slug(db, Product, payload.name, extra_filter=Product.business_id == business.id)
    product = Product(
        business_id=business.id,
        category_id=payload.category_id,
        name=payload.name,
        slug=slug,
        description=payload.description,
        price=payload.price,
        sale_price=payload.sale_price,
        sku=payload.sku,
        stock_quantity=payload.stock_quantity,
        tags=payload.tags,
    )
    db.add(product)
    db.flush()
    _recompute_status(product)

    for i, img in enumerate(payload.images):
        db.add(ProductImage(product_id=product.id, url=img.url, sort_order=i, is_primary=img.is_primary or i == 0))

    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: uuid.UUID, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == business.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: uuid.UUID, payload: ProductUpdate, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == business.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    data = payload.model_dump(exclude_unset=True)
    explicit_status = data.pop("status", None)
    for field, value in data.items():
        setattr(product, field, value)

    if explicit_status:
        product.status = explicit_status
    else:
        _recompute_status(product)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: uuid.UUID, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == business.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()


@router.post("/{product_id}/mark-sold", response_model=ProductOut)
def mark_sold(product_id: uuid.UUID, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == business.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.previous_status = product.status
    product.status = ProductStatus.sold
    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/reactivate", response_model=ProductOut)
def reactivate(product_id: uuid.UUID, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == business.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.status = product.previous_status or ProductStatus.available
    product.previous_status = None
    _recompute_status(product)
    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/images", response_model=ProductOut)
def add_image(product_id: uuid.UUID, url: str, is_primary: bool = False, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == business.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    max_order = db.query(ProductImage).filter(ProductImage.product_id == product.id).count()
    db.add(ProductImage(product_id=product.id, url=url, sort_order=max_order, is_primary=is_primary))
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}/images/{image_id}", response_model=ProductOut)
def delete_image(product_id: uuid.UUID, image_id: uuid.UUID, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == business.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    image = db.query(ProductImage).filter(ProductImage.id == image_id, ProductImage.product_id == product.id).first()
    if image:
        db.delete(image)
        db.commit()
        db.refresh(product)
    return product


@router.post("/{product_id}/variants", response_model=ProductVariantOut, status_code=201)
def add_variant(product_id: uuid.UUID, payload: ProductVariantCreate, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == business.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    variant = ProductVariant(product_id=product.id, **payload.model_dump())
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant


@router.patch("/{product_id}/variants/{variant_id}", response_model=ProductVariantOut)
def update_variant(product_id: uuid.UUID, variant_id: uuid.UUID, payload: ProductVariantUpdate, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == business.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    variant = db.query(ProductVariant).filter(ProductVariant.id == variant_id, ProductVariant.product_id == product.id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(variant, field, value)
    db.commit()
    db.refresh(variant)
    return variant


@router.delete("/{product_id}/variants/{variant_id}", status_code=204)
def delete_variant(product_id: uuid.UUID, variant_id: uuid.UUID, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == business.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    variant = db.query(ProductVariant).filter(ProductVariant.id == variant_id, ProductVariant.product_id == product.id).first()
    if variant:
        db.delete(variant)
        db.commit()
