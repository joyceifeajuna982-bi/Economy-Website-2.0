import os
import sqlite3
import time
import uuid
from flask import Flask, jsonify, request
from flask_cors import CORS

# ============================================================
# BIZSPARK BACKEND
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
# CONFIGURATION
# ============================================================

DEFAULT_IMG = (
    "https://images.unsplash.com/"
    "photo-1523275335684-37898b6baf30?w=800"
)

# Vercel serverless functions only provide temporary writable
# storage in /tmp.
DB_NAME = os.environ.get(
    "BIZSPARK_DB_PATH",
    "/tmp/bizspark.db"
)


# ============================================================
# DATABASE
# ============================================================

def get_db():
    connection = sqlite3.connect(
        DB_NAME,
        timeout=20
    )

    connection.row_factory = sqlite3.Row

    return connection


def init_db():
    with get_db() as db:

        # ----------------------------------------------------
        # USERS
        # ----------------------------------------------------

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                businessName TEXT NOT NULL,
                createdAt TEXT NOT NULL
            )
            """
        )

        # ----------------------------------------------------
        # PRODUCTS
        # ----------------------------------------------------

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                userId TEXT,
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

        # ----------------------------------------------------
        # ORDERS
        # ----------------------------------------------------

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

def now():
    return time.strftime(
        "%Y-%m-%dT%H:%M:%SZ",
        time.gmtime()
    )


def clean_text(value, default=""):
    if value is None:
        return default

    return str(value).strip()


def get_request_user_id():
    """
    Current frontend uses a local token.

    This function supports the current structure while leaving
    room for real authentication later.
    """

    authorization = request.headers.get(
        "Authorization",
        ""
    )

    if not authorization:
        return None

    if not authorization.startswith("Bearer "):
        return None

    token = authorization.replace(
        "Bearer ",
        "",
        1
    ).strip()

    if not token:
        return None

    # Current frontend token format:
    # local_XXXXXXXXXXXX

    if token.startswith("local_"):
        return None

    return token


def product_to_dict(row):
    return {
        "id": row["id"],
        "userId": row["userId"],
        "businessName": row["businessName"],
        "productName": row["productName"],
        "price": float(row["price"]),
        "description": row["description"] or "",
        "category": row["category"] or "General",
        "mediaUrl": row["mediaUrl"] or DEFAULT_IMG,
        "createdAt": row["createdAt"]
    }


# ============================================================
# API HOME
# ============================================================

@app.route("/api", methods=["GET"])
def api_home():

    return jsonify(
        {
            "ok": True,
            "service": "BizSpark API",
            "version": "2.0.0"
        }
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/api/health", methods=["GET"])
def health():

    try:

        init_db()

        with get_db() as db:

            db.execute(
                "SELECT 1"
            ).fetchone()

        return jsonify(
            {
                "ok": True,
                "database": "connected"
            }
        )

    except Exception as error:

        return jsonify(
            {
                "ok": False,
                "error": "Database health check failed",
                "details": str(error)
            }
        ), 500


# ============================================================
# PRODUCTS
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
                    userId,
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
            product_to_dict(row)
            for row in rows
        ]

        return jsonify(products), 200

    except Exception as error:

        return jsonify(
            {
                "error": "Failed to fetch products",
                "details": str(error)
            }
        ), 500


# ============================================================
# ADD PRODUCT
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

        product_name = clean_text(
            request.form.get("productName")
        )

        business_name = clean_text(
            request.form.get("businessName"),
            "Merchant"
        )

        category = clean_text(
            request.form.get("category"),
            "General"
        )

        description = clean_text(
            request.form.get("description")
        )

        price_raw = clean_text(
            request.form.get("price"),
            "0"
        )

        # ----------------------------------------------------
        # VALIDATION
        # ----------------------------------------------------

        if not product_name:

            return jsonify(
                {
                    "error": "Product name is required"
                }
            ), 400

        if len(product_name) > 120:

            return jsonify(
                {
                    "error": "Product name is too long"
                }
            ), 400

        if len(description) > 1000:

            return jsonify(
                {
                    "error": "Product description is too long"
                }
            ), 400

        try:

            price = float(price_raw)

        except ValueError:

            return jsonify(
                {
                    "error": "Invalid product price"
                }
            ), 400

        if price < 0:

            return jsonify(
                {
                    "error": "Product price cannot be negative"
                }
            ), 400

        price = round(price, 2)

        # ----------------------------------------------------
        # IMAGE
        # ----------------------------------------------------

        media_url = DEFAULT_IMG

        uploaded_file = request.files.get(
            "image"
        )

        if uploaded_file:

            # At this stage we do not permanently store the file.
            # A real storage provider will be connected later.
            #
            # We still validate the file type.

            allowed_types = {
                "image/jpeg",
                "image/png",
                "image/webp"
            }

            if uploaded_file.mimetype not in allowed_types:

                return jsonify(
                    {
                        "error": (
                            "Only JPG, PNG and WebP "
                            "images are allowed"
                        )
                    }
                ), 400

        # ----------------------------------------------------
        # USER
        # ----------------------------------------------------

        user_id = get_request_user_id()

        product_id = (
            "prod_"
            + uuid.uuid4().hex
        )

        created_at = now()

        # ----------------------------------------------------
        # SAVE
        # ----------------------------------------------------

        with get_db() as db:

            db.execute(
                """
                INSERT INTO products (
                    id,
                    userId,
                    businessName,
                    productName,
                    price,
                    description,
                    category,
                    mediaUrl,
                    createdAt
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    product_id,
                    user_id,
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

        return jsonify(
            {
                "success": True,
                "id": product_id,
                "message": "Product published successfully"
            }
        ), 201

    except Exception as error:

        return jsonify(
            {
                "error": "Failed to publish product",
                "details": str(error)
            }
        ), 500


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

            return jsonify(
                {
                    "error": "Product not found"
                }
            ), 404

        return jsonify(
            {
                "success": True,
                "message": "Product deleted successfully"
            }
        ), 200

    except Exception as error:

        return jsonify(
            {
                "error": "Failed to delete product",
                "details": str(error)
            }
        ), 500


# ============================================================
# ORDERS
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

        customer_name = clean_text(
            data.get("customerName")
        )

        email = clean_text(
            data.get("email")
        ).lower()

        items = data.get("items")

        if not isinstance(items, list):
            items = []

        # ----------------------------------------------------
        # VALIDATION
        # ----------------------------------------------------

        if not customer_name:

            return jsonify(
                {
                    "error": "Customer name is required"
                }
            ), 400

        if not email:

            return jsonify(
                {
                    "error": "Customer email is required"
                }
            ), 400

        if "@" not in email:

            return jsonify(
                {
                    "error": "Invalid email address"
                }
            ), 400

        if not items:

            return jsonify(
                {
                    "error": "Your cart is empty"
                }
            ), 400

        # ----------------------------------------------------
        # CALCULATE TOTAL
        # ----------------------------------------------------

        total = 0.0

        for item in items:

            try:

                price = float(
                    item.get("price", 0)
                )

                quantity = int(
                    item.get("qty", 1)
                )

            except (
                ValueError,
                TypeError
            ):

                return jsonify(
                    {
                        "error": "Invalid order item"
                    }
                ), 400

            if price < 0:
                return jsonify(
                    {
                        "error": "Invalid item price"
                    }
                ), 400

            if quantity < 1:
                return jsonify(
                    {
                        "error": "Invalid item quantity"
                    }
                ), 400

            if quantity > 100:
                return jsonify(
                    {
                        "error": "Quantity is too large"
                    }
                ), 400

            total += price * quantity

        total = round(total, 2)

        # ----------------------------------------------------
        # CREATE ORDER
        # ----------------------------------------------------

        order_id = (
            "order_"
            + uuid.uuid4().hex
        )

        order_date = now()

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
                    total,
                    "Pending",
                    order_date
                )
            )

            db.commit()

        return jsonify(
            {
                "success": True,
                "orderId": order_id,
                "amount": total,
                "status": "Pending",
                "message": "Order placed successfully"
            }
        ), 201

    except Exception as error:

        return jsonify(
            {
                "error": "Failed to create order",
                "details": str(error)
            }
        ), 500


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

            # ------------------------------------------------
            # ORDERS
            # ------------------------------------------------

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

            # ------------------------------------------------
            # PRODUCTS
            # ------------------------------------------------

            products = db.execute(
                """
                SELECT
                    id,
                    userId,
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

        order_list = [
            dict(order)
            for order in orders
        ]

        product_list = [
            product_to_dict(product)
            for product in products
        ]

        # ----------------------------------------------------
        # STATS
        # ----------------------------------------------------

        revenue = sum(
            float(order["amount"])
            for order in orders
            if order["status"] != "Cancelled"
        )

        customers = len(
            {
                order["email"]
                for order in orders
            }
        )

        return jsonify(
            {
                "success": True,
                "revenue": round(
                    revenue,
                    2
                ),
                "orders": len(
                    order_list
                ),
                "products": len(
                    product_list
                ),
                "customers": customers,
                "transactions": order_list,
                "productsList": product_list
            }
        ), 200

    except Exception as error:

        return jsonify(
            {
                "error": "Failed to load dashboard data",
                "details": str(error)
            }
        ), 500


# ============================================================
# ERROR HANDLERS
# ============================================================

@app.errorhandler(404)
def not_found(error):

    return jsonify(
        {
            "error": "API endpoint not found"
        }
    ), 404


@app.errorhandler(405)
def method_not_allowed(error):

    return jsonify(
        {
            "error": "Method not allowed"
        }
    ), 405


@app.errorhandler(500)
def internal_error(error):

    return jsonify(
        {
            "error": "Internal server error"
        }
    ), 500


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

    app.run(
        host="0.0.0.0",
        port=port,
        debug=True
    )

