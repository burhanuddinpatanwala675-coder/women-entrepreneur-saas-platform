from app.models.product import Product, ProductStatus


def recompute_product_status(product: Product) -> None:
    """Keeps status consistent with stock unless the seller has explicitly hidden or
    sold the product (those are manual overrides that stock changes should not undo)."""
    if product.status in (ProductStatus.sold, ProductStatus.hidden):
        return
    if product.stock_quantity <= 0:
        product.status = ProductStatus.out_of_stock
    elif product.stock_quantity <= product.low_stock_threshold:
        product.status = ProductStatus.low_stock
    else:
        product.status = ProductStatus.available
