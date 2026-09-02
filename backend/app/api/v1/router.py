from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    categories,
    businesses,
    uploads,
    products,
    public_storefront,
    orders,
    customers,
    vouchers,
    gift_cards,
    ai_assistant,
    admin,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(businesses.router)
api_router.include_router(uploads.router)
api_router.include_router(products.router)
api_router.include_router(public_storefront.router)
api_router.include_router(orders.router)
api_router.include_router(customers.router)
api_router.include_router(vouchers.router)
api_router.include_router(gift_cards.router)
api_router.include_router(ai_assistant.router)
api_router.include_router(admin.router)
