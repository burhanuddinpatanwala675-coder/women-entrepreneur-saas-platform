"""WhatsApp order-message builder.

MVP: generates a standard wa.me deep link with a pre-filled message — no API keys or
business account approval required. The message format below intentionally includes
every field a future WhatsApp Business Cloud API template message would need
(product, variant, quantity, price, order link) so that upgrading later is a matter of
swapping *how* the message is sent, not what data it carries.
"""
import re
from urllib.parse import quote

from app.models.order import Order


def normalize_whatsapp_number(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    return digits


def build_order_message(order: Order, business_name: str, storefront_url: str) -> str:
    lines = [f"Hello! I would like to order from {business_name}:", ""]
    for item in order.items:
        line = f"• {item.product_name_snapshot}"
        if item.variant_name_snapshot:
            line += f" ({item.variant_name_snapshot})"
        line += f" x{item.quantity} — Rs. {item.line_total:,.0f}"
        lines.append(line)
    lines.append("")
    lines.append(f"Total: Rs. {order.total:,.0f}")
    lines.append("")
    lines.append(f"Order reference: {order.order_number}")
    lines.append(f"Store: {storefront_url}")
    return "\n".join(lines)


def build_whatsapp_link(whatsapp_number: str, message: str) -> str:
    number = normalize_whatsapp_number(whatsapp_number)
    return f"https://wa.me/{number}?text={quote(message)}"
