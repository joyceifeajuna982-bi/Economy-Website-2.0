import os
import re
import sqlite3
import time
import uuid
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS


# ============================================================
# APP
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

# Vercel's serverless filesystem is temporary.
# /tmp is writable on Vercel.
if os.getenv("VERCEL"):
    DB_NAME = "/tmp/bizspark.db"
else:
    DB_NAME = os.path.join(
        os.path.dirname(
            os.path.abspath(__file__)
        ),
        "..",
        "bizspark.db"
    )


# ============================================================
# DATABASE
# ============================================================

def get_db():
    """
    Open a SQLite connection.

    Row factory lets us access columns by name.
    """
    connection = sqlite3.connect(
        DB_NAME,
        timeout=20
    )

    connection.row_factory = sqlite3.Row

    return connection


def init_db():
    """
    Create database tables if they don't already exist.
    """

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


# Initialize when the module loads.
init_db()


# ============================================================
# HELPERS
# ============================================================

def utc_now():
    """
    Return current UTC time in ISO-like format.
    """
    return time.strftime(
        "%Y-%m-%dT%H:%M:%SZ",
        time.gmtime()
    )


def clean_string(
    value: Any,
    default: str = ""
) -> str:
    """
    Safely convert a value to a trimmed string.
    """
    if value is None:
        return default

    return str(value).strip()


def is_valid_email(email: str) -> bool:
    """
    Basic email validation.

    This is intentionally not an exhaustive RFC validator.
    """
    if not email:
        return False

    if len(email) > MAX_EMAIL_LENGTH:
        return False

    pattern = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

    return bool(
        re.match(
            pattern,
            email
        )
    )


def json_error(
    message: str,
    status: int = 400,
    details: str | None = None
):
    """
    Standard API error response.
    """

    response = {
        "error": message
    }

    if details:
        response["details"] = details

    return jsonify(response), status


def get_cloudinary_config():
    """
    Read Cloudinary credentials from environment variables.
    """

    cloud_name = os.getenv(
        "CLOUDINARY_CLOUD_NAME"
    )

    api_key = os.getenv(
        "CLOUDINARY_API_KEY"
    )

    api_secret = os.getenv(
        "CLOUDINARY_API_SECRET"
    )

    available = all([
        cloud_name,
        api_key,
        api_secret
    ])

    return {
        "available": available,
        "cloud_name": cloud_name,
        "api_key": api_key,
        "api_secret": api_secret
    }


def upload_image_to_cloudinary(uploaded_file):
    """
    Upload an image to Cloudinary.

    Returns the secure URL.

    If Cloudinary isn't configured, returns the default image.
    """

    if not uploaded_file:
        return DEFAULT_IMG

    if not uploaded_file.filename:
        return DEFAULT_IMG

    config = get_cloudinary_config()

    if not config["available"]:
        print(
            "Cloudinary is not configured. "
            "Using default image."
        )

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

        secure_url = result.get(
            "secure_url"
        )

        if secure_url:
            return secure_url

        return DEFAULT_IMG

    except Exception as error:

        print(
            "CLOUDINARY UPLOAD ERROR:",
            repr(error)
        )

        # Do not prevent the product from being created
        # simply because image hosting failed.
        return DEFAULT_IMG


def calculate_order_total(items):
    """
    Calculate an order total using prices stored in SQLite.

    IMPORTANT:
    We never trust the price supplied by the browser.
    """

    if not isinstance(items, list):
        return 0.0

    total = 0.0

    with get_db() as db:

        for item in items:

            if not isinstance(item, dict):
                continue

            product_id = clean_string(
                item.get("id")
            )

            try:
                quantity = int(
                    item.get(
                        "qty",
                        0
                    )
                )
            except (
                ValueError,
                TypeError
            ):
                continue

            if not product_id:
                continue

            if quantity <= 0:
                continue

            # Prevent absurd quantities.
            if quantity > 100:
                quantity = 100

            product = db.execute(
                """
                SELECT price
                FROM products
                WHERE id = ?
                """,
                (product_id,)
            ).fetchone()

            if not product:
                continue

            actual_price = float(
                product["price"]
            )

            total += (
                actual_price *
                quantity
            )

    return round(
        total,
        2
    )


# ============================================================
# CORS / OPTIONS
# ============================================================

@app.after_request
def add_cors_headers(response):

    response.headers[
        "Access-Control-Allow-Origin"
    ] = "*"

    response.headers[
        "Access-Control-Allow-Headers"
    ] = (
        "Content-Type, "
        "Authorization, "
        "X-Requested-With"
    )

    response.headers[
        "Access-Control-Allow-Methods"
    ] = (
        "GET, "
        "POST, "
        "DELETE, "
        "OPTIONS"
    )

    return response


# ============================================================
# HOME
# ============================================================

@app.route(
    "/api",
    methods=["GET"]
)
def api_home():

    return jsonify({
        "ok": True,
        "service": "BizSpark API",
        "version": "1.0.0"
    })


# ============================================================
# HEALTH
# ============================================================

@app.route(
    "/api/health",
    methods=["GET"]
)
def health():

    try:

        init_db()

        return jsonify({
            "ok": True,
            "database": DB_NAME
        })

    except Exception as error:

        print(
            "HEALTH ERROR:",
            repr(error)
        )

        return json_error(
            "Database health check failed",
            500,
            str(error)
        )


# ============================================================
# PRODUCTS - GET
# ============================================================

@app.route(
    "/api/products",
    methods=["GET", "OPTIONS"]
)
def get_products():

    if request.method == "OPTIONS":
        return "", 204

    try:

        init_db()

        with get_db() as db:

            rows = db.execute(
                """
                SELECT
                    id,
                    businessName,
                    productName,
                    price,
                    description,
                    category,
                    mediaUrl,
                    createdAt
                FROM products
                ORDER BY createdAt DESC
                """
            ).fetchall()

        products = [
            dict(row)
            for row in rows
        ]

        return jsonify(products), 200

    except Exception as error:

        print(
            "GET PRODUCTS ERROR:",
            repr(error)
        )

        return json_error(
            "Failed to fetch products",
            500,
            str(error)
        )


# ============================================================
# PRODUCTS - CREATE
# ============================================================

@app.route(
    "/api/products",
    methods=["POST", "OPTIONS"]
)
def add_product():

    if request.method == "OPTIONS":
        return "", 204

    try:

        init_db()

        print(
            "POST /api/products received"
        )

        print(
            "Content-Type:",
            request.content_type
        )

        # ----------------------------------------------------
        # FORM DATA
        # ----------------------------------------------------

        product_name = clean_string(
            request.form.get(
                "productName"
            )
        )

        business_name = clean_string(
            request.form.get(
                "businessName"
            ),
            "Merchant"
        )

        category = clean_string(
            request.form.get(
                "category"
            ),
            "General"
        )

        description = clean_string(
            request.form.get(
                "description"
            )
        )

        price_raw = clean_string(
            request.form.get(
                "price"
            ),
            "0"
        )

        # ----------------------------------------------------
        # VALIDATION
        # ----------------------------------------------------

        if not product_name:

            return json_error(
                "Product name is required",
                400
            )

        if len(product_name) > MAX_PRODUCT_NAME_LENGTH:

            return json_error(
                "Product name is too long",
                400
            )

        if not business_name:

            business_name = "Merchant"

        if len(business_name) > MAX_BUSINESS_NAME_LENGTH:

            return json_error(
                "Business name is too long",
                400
            )

        if len(category) > MAX_CATEGORY_LENGTH:

            return json_error(
                "Category is too long",
                400
            )

        if len(description) > MAX_DESCRIPTION_LENGTH:

            return json_error(
                "Description is too long",
                400
            )

        # ----------------------------------------------------
        # PRICE
        # ----------------------------------------------------

        try:

            price = float(
                price_raw
            )

        except (
            ValueError,
            TypeError
        ):

            return json_error(
                "Invalid product price",
                400
            )

        if price < 0:

            return json_error(
                "Price cannot be negative",
                400
            )

        if price != price:

            return json_error(
                "Invalid product price",
                400
            )

        # Keep prices at two decimal places.
        price = round(
            price,
            2
        )

        # ----------------------------------------------------
        # IMAGE
        # ----------------------------------------------------

        uploaded_file = (
            request.files.get(
                "productImage"
            )
            or request.files.get(
                "image"
            )
        )

        media_url = DEFAULT_IMG

        if uploaded_file:

            print(
                "Uploaded image:",
                uploaded_file.filename
            )

            print(
                "Image content type:",
                uploaded_file.content_type
            )

            media_url = (
                upload_image_to_cloudinary(
                    uploaded_file
                )
            )

        # ----------------------------------------------------
        # CREATE PRODUCT
        # ----------------------------------------------------

        product_id = (
            "prod_" +
            uuid.uuid4().hex
        )

        created_at = utc_now()

        with get_db() as db:

            db.execute(
                """
                INSERT INTO products (
                    id,
                    businessName,
                    productName,
                    price,
                    description,
                    category,
                    mediaUrl,
                    createdAt
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    product_id,
                    business_name,
                    product_name,
                    price,
                    description,
                    category,
                    media_url,
                    created_at
                )
            )

            db.commit()

        print(
            "PRODUCT CREATED:",
            product_id
        )

        return jsonify({
            "success": True,
            "id": product_id,
            "message":
                "Product published successfully",
            "mediaUrl": media_url
        }), 201

    except Exception as error:

        print(
            "POST PRODUCT ERROR:",
            repr(error)
        )

        return json_error(
            "Failed to publish product",
            500,
            str(error)
        )


# ============================================================
# DELETE PRODUCT
# ============================================================

@app.route(
    "/api/products/<p_id>",
    methods=["DELETE", "OPTIONS"]
)
def delete_product(p_id):

    if request.method == "OPTIONS":
        return "", 204

    try:

        init_db()

        p_id = clean_string(
            p_id
        )

        if not p_id:

            return json_error(
                "Product ID is required",
                400
            )

        with get_db() as db:

            cursor = db.execute(
                """
                DELETE FROM products
                WHERE id = ?
                """,
                (p_id,)
            )

            deleted = cursor.rowcount

            db.commit()

        if deleted == 0:

            return json_error(
                "Product not found",
                404
            )

        print(
            "PRODUCT DELETED:",
            p_id
        )

        return jsonify({
            "success": True,
            "message":
                "Product deleted successfully"
        }), 200

    except Exception as error:

        print(
            "DELETE PRODUCT ERROR:",
            repr(error)
        )

        return json_error(
            "Failed to delete product",
            500,
            str(error)
        )


# ============================================================
# ORDERS - CREATE
# ============================================================

@app.route(
    "/api/orders",
    methods=["POST", "OPTIONS"]
)
def create_order():

    if request.method == "OPTIONS":
        return "", 204

    try:

        init_db()

        data = request.get_json(
            silent=True
        ) or {}

        if not isinstance(data, dict):

            return json_error(
                "Invalid order data",
                400
            )

        customer_name = clean_string(
            data.get(
                "customerName"
            )
        )

        email = clean_string(
            data.get(
                "email"
            )
        ).lower()

        items = data.get(
            "items"
        ) or []

        # ----------------------------------------------------
        # VALIDATE CUSTOMER
        # ----------------------------------------------------

        if not customer_name:

            return json_error(
                "Customer name is required",
                400
            )

        if len(customer_name) > MAX_CUSTOMER_NAME_LENGTH:

            return json_error(
                "Customer name is too long",
                400
            )

        if not email:

            return json_error(
                "Customer email is required",
                400
            )

        if not is_valid_email(email):

            return json_error(
                "Please provide a valid email address",
                400
            )

        # ----------------------------------------------------
        # VALIDATE ITEMS
        # ----------------------------------------------------

        if not isinstance(items, list):

            return json_error(
                "Invalid order items",
                400
            )

        if not items:

            return json_error(
                "Order contains no items",
                400
            )

        # ----------------------------------------------------
        # CALCULATE REAL TOTAL
        # ----------------------------------------------------

        amount = calculate_order_total(
            items
        )

        if amount <= 0:

            return json_error(
                "Invalid order total",
                400
            )

        # ----------------------------------------------------
        # CREATE ORDER
        # ----------------------------------------------------

        order_id = (
            "order_" +
            uuid.uuid4().hex
        )

        date = utc_now()

        with get_db() as db:

            db.execute(
                """
                INSERT INTO orders (
                    id,
                    customerName,
                    email,
                    amount,
                    status,
                    date
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    order_id,
                    customer_name,
                    email,
                    amount,
                    "Pending",
                    date
                )
            )

            db.commit()

        print(
            "ORDER CREATED:",
            order_id,
            "AMOUNT:",
            amount
        )

        return jsonify({
            "success": True,
            "orderId": order_id,
            "message":
                "Order placed successfully",
            "amount": amount
        }), 201

    except Exception as error:

        print(
            "POST ORDER ERROR:",
            repr(error)
        )

        return json_error(
            "Failed to create order",
            500,
            str(error)
        )


# ============================================================
# DASHBOARD
# ============================================================

@app.route(
    "/api/dashboard",
    methods=["GET", "OPTIONS"]
)
def get_dashboard():

    if request.method == "OPTIONS":
        return "", 204

    try:

        init_db()

        with get_db() as db:

            orders = db.execute(
                """
                SELECT
                    id,
                    customerName,
                    email,
                    amount,
                    status,
                    date
                FROM orders
                ORDER BY date DESC
                """
            ).fetchall()

        transactions = [
            dict(row)
            for row in orders
        ]

        return jsonify({
            "transactions": transactions
        }), 200

    except Exception as error:

        print(
            "DASHBOARD ERROR:",
            repr(error)
        )

        return json_error(
            "Failed to load dashboard data",
            500,
            str(error)
        )


# ============================================================
# LOCAL DEVELOPMENT
# ============================================================

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            5000
        )
    )

    print(
        "======================================"
    )

    print(
        "      BizSpark API Starting..."
    )

    print(
        "======================================"
    )

    print(
        f"Database: {DB_NAME}"
    )

    print(
        f"Port: {port}"
    )

    print(
        "======================================"
    )

    app.run(
        host="0.0.0.0",
        port=port,
        debug=True
    )