import os
import re
import sqlite3
import time
import uuid
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS

# ============================================================
# APP & CORS
# ============================================================

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": "*"
        }
    }
)

# ============================================================
# CONFIG
# ============================================================

DEFAULT_IMG = (
    "https://images.unsplash.com/"
    "photo-1523275335684-37898b6baf30"
    "?w=800"
)

MAX_PRODUCT_NAME_LENGTH = 200
MAX_BUSINESS_NAME_LENGTH = 200
MAX_CATEGORY_LENGTH = 100
MAX_DESCRIPTION_LENGTH = 1000
MAX_CUSTOMER_NAME_LENGTH = 200
MAX_EMAIL_LENGTH = 320

# Safe database path detection for Vercel / Serverless read-only environments
if os.getenv("VERCEL") or os.getenv("VERCEL_ENV") or not os.access(".", os.W_OK):
    DB_NAME = "/tmp/bizspark.db"
else:
    DB_NAME = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "bizspark.db"
    )

# ============================================================
# DATABASE
# ============================================================

def get_db():
    connection = sqlite3.connect(DB_NAME, timeout=20)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                businessName TEXT NOT NULL,
                productName TEXT NOT NULL,
                price REAL NOT NULL DEFAULT 0,
                description TEXT DEFAULT '',
                category TEXT DEFAULT 'General',
                mediaUrl TEXT DEFAULT '',
                createdAt TEXT NOT NULL
            )
            """
        )

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                customerName TEXT NOT NULL,
                email TEXT NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                date TEXT NOT NULL
            )
            """
        )

        db.commit()


init_db()

# ============================================================
# HELPERS
# ============================================================

def utc_now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def clean_string(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def is_valid_email(email: str) -> bool:
    if not email or len(email) > MAX_EMAIL_LENGTH:
        return False
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


def json_error(message: str, status: int = 400, details: str | None = None):
    response = {"error": message}
    if details:
        response["details"] = details
    return jsonify(response), status


def get_cloudinary_config():
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    return {
        "available": all([cloud_name, api_key, api_secret]),
        "cloud_name": cloud_name,
        "api_key": api_key,
        "api_secret": api_secret
    }


def upload_image_to_cloudinary(uploaded_file):
    if not uploaded_file or not uploaded_file.filename:
        return DEFAULT_IMG

    config = get_cloudinary_config()

    if not config["available"]:
        return DEFAULT_IMG

    try:
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=config["cloud_name"],
            api_key=config["api_key"],
            api_secret=config["api_secret"],
            secure=True
        )

        result = cloudinary.uploader.upload(
            uploaded_file,
            folder="bizspark/products",
            resource_type="image"
        )

        return result.get("secure_url") or DEFAULT_IMG

    except Exception as error:
        print("CLOUDINARY UPLOAD ERROR:", repr(error))
        return DEFAULT_IMG


def calculate_order_total(items):
    if not isinstance(items, list):
        return 0.0

    total = 0.0

    with get_db() as db:
        for item in items:
            if not isinstance(item, dict):
                continue

            product_id = clean_string(item.get("id"))
            try:
                quantity = int(item.get("qty", 0))
            except (ValueError, TypeError):
                continue

            if not product_id or quantity <= 0:
                continue

            quantity = min(quantity, 100)

            product = db.execute(
                "SELECT price FROM products WHERE id = ?",
                (product_id,)
            ).fetchone()

            if product:
                total += float(product["price"]) * quantity

    return round(total, 2)

# ============================================================
# CORS HEADERS
# ============================================================

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    return response

# ============================================================
# ROUTES
# ============================================================

@app.route("/api", methods=["GET"])
def api_home():
    return jsonify({"ok": True, "service": "BizSpark API", "version": "1.0.0"})


@app.route("/api/health", methods=["GET"])
def health():
    try:
        init_db()
        return jsonify({"ok": True, "database": DB_NAME})
    except Exception as error:
        return json_error("Database health check failed", 500, str(error))


@app.route("/api/products", methods=["GET", "OPTIONS"])
def get_products():
    if request.method == "OPTIONS":
        return "", 204

    try:
        init_db()
        with get_db() as db:
            rows = db.execute(
                """
                SELECT id, businessName, productName, price, description, category, mediaUrl, createdAt
                FROM products ORDER BY createdAt DESC
                """
            ).fetchall()

        return jsonify([dict(row) for row in rows]), 200
    except Exception as error:
        return json_error("Failed to fetch products", 500, str(error))


@app.route("/api/products", methods=["POST", "OPTIONS"])
def add_product():
    if request.method == "OPTIONS":
        return "", 204

    try:
        init_db()

        product_name = clean_string(request.form.get("productName"))
        business_name = clean_string(request.form.get("businessName"), "Merchant")
        category = clean_string(request.form.get("category"), "General")
        description = clean_string(request.form.get("description"))
        price_raw = clean_string(request.form.get("price"), "0")

        if not product_name:
            return json_error("Product name is required", 400)

        if len(product_name) > MAX_PRODUCT_NAME_LENGTH:
            return json_error("Product name is too long", 400)

        if len(business_name) > MAX_BUSINESS_NAME_LENGTH:
            return json_error("Business name is too long", 400)

        try:
            price = float(price_raw)
        except (ValueError, TypeError):
            return json_error("Invalid product price", 400)

        if price < 0 or price != price:
            return json_error("Invalid product price", 400)

        price = round(price, 2)

        uploaded_file = request.files.get("productImage") or request.files.get("image")
        media_url = upload_image_to_cloudinary(uploaded_file) if uploaded_file else DEFAULT_IMG

        product_id = "prod_" + uuid.uuid4().hex
        created_at = utc_now()

        with get_db() as db:
            db.execute(
                """
                INSERT INTO products (id, businessName, productName, price, description, category, mediaUrl, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (product_id, business_name, product_name, price, description, category, media_url, created_at)
            )
            db.commit()

        return jsonify({
            "success": True,
            "id": product_id,
            "message": "Product published successfully",
            "mediaUrl": media_url
        }), 201

    except Exception as error:
        return json_error("Failed to publish product", 500, str(error))


@app.route("/api/products/<p_id>", methods=["DELETE", "OPTIONS"])
def delete_product(p_id):
    if request.method == "OPTIONS":
        return "", 204

    try:
        init_db()
        p_id = clean_string(p_id)

        if not p_id:
            return json_error("Product ID is required", 400)

        with get_db() as db:
            cursor = db.execute("DELETE FROM products WHERE id = ?", (p_id,))
            deleted = cursor.rowcount
            db.commit()

        if deleted == 0:
            return json_error("Product not found", 404)

        return jsonify({"success": True, "message": "Product deleted successfully"}), 200
    except Exception as error:
        return json_error("Failed to delete product", 500, str(error))


@app.route("/api/orders", methods=["POST", "OPTIONS"])
def create_order():
    if request.method == "OPTIONS":
        return "", 204

    try:
        init_db()
        data = request.get_json(silent=True) or {}

        if not isinstance(data, dict):
            return json_error("Invalid order data", 400)

        customer_name = clean_string(data.get("customerName"))
        email = clean_string(data.get("email")).lower()
        items = data.get("items") or []

        if not customer_name or len(customer_name) > MAX_CUSTOMER_NAME_LENGTH:
            return json_error("Valid customer name is required", 400)

        if not email or not is_valid_email(email):
            return json_error("Valid email address is required", 400)

        if not items or not isinstance(items, list):
            return json_error("Order contains no items", 400)

        amount = calculate_order_total(items)
        if amount <= 0:
            return json_error("Invalid order total", 400)

        order_id = "order_" + uuid.uuid4().hex
        date = utc_now()

        with get_db() as db:
            db.execute(
                """
                INSERT INTO orders (id, customerName, email, amount, status, date)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (order_id, customer_name, email, amount, "Pending", date)
            )
            db.commit()

        return jsonify({
            "success": True,
            "orderId": order_id,
            "message": "Order placed successfully",
            "amount": amount
        }), 201

    except Exception as error:
        return json_error("Failed to create order", 500, str(error))


@app.route("/api/dashboard", methods=["GET", "OPTIONS"])
def get_dashboard():
    if request.method == "OPTIONS":
        return "", 204

    try:
        init_db()
        with get_db() as db:
            orders = db.execute(
                "SELECT id, customerName, email, amount, status, date FROM orders ORDER BY date DESC"
            ).fetchall()

        return jsonify({"transactions": [dict(row) for row in orders]}), 200
    except Exception as error:
        return json_error("Failed to load dashboard data", 500, str(error))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)