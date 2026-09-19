import os
import sqlite3
import time
import uuid

from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": "*"
        }
    }
)


DEFAULT_IMG = (
    "https://images.unsplash.com/"
    "photo-1523275335684-37898b6baf30?w=800"
)


# ============================================================
# DATABASE
# ============================================================

if os.getenv("VERCEL"):
    DB_NAME = "/tmp/bizspark.db"
else:
    DB_NAME = "bizspark.db"


def get_db():
    connection = sqlite3.connect(
        DB_NAME,
        timeout=20
    )

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
# CORS
# ============================================================

@app.after_request
def add_cors_headers(response):

    response.headers[
        "Access-Control-Allow-Origin"
    ] = "*"

    response.headers[
        "Access-Control-Allow-Headers"
    ] = (
        "Content-Type, Authorization, "
        "X-Requested-With"
    )

    response.headers[
        "Access-Control-Allow-Methods"
    ] = (
        "GET, POST, DELETE, OPTIONS"
    )

    return response


# ============================================================
# HOME / HEALTH
# ============================================================

@app.route(
    "/api",
    methods=["GET"]
)
def api_home():

    return jsonify({
        "ok": True,
        "service": "BizSpark API"
    })


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

        return jsonify({
            "ok": False,
            "error": str(error)
        }), 500


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

        return jsonify(
            [dict(row) for row in rows]
        ), 200

    except Exception as error:

        print(
            "GET PRODUCTS ERROR:",
            repr(error)
        )

        return jsonify({
            "error": "Failed to fetch products",
            "details": str(error)
        }), 500


# ============================================================
# PRODUCTS - POST
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

        print(
            "Form:",
            dict(request.form)
        )

        print(
            "Files:",
            list(request.files.keys())
        )

        product_name = (
            request.form.get("productName")
            or ""
        ).strip()

        business_name = (
            request.form.get("businessName")
            or "Merchant"
        ).strip()

        category = (
            request.form.get("category")
            or "General"
        ).strip()

        description = (
            request.form.get("description")
            or ""
        ).strip()

        price_raw = (
            request.form.get("price")
            or "0"
        ).strip()

        # ----------------------------------------------------
        # VALIDATION
        # ----------------------------------------------------

        if not product_name:

            return jsonify({
                "error":
                    "Product name is required"
            }), 400

        if len(product_name) > 200:

            return jsonify({
                "error":
                    "Product name is too long"
            }), 400

        if len(business_name) > 200:

            return jsonify({
                "error":
                    "Business name is too long"
            }), 400

        try:

            price = float(
                price_raw
            )

        except (
            ValueError,
            TypeError
        ):

            return jsonify({
                "error":
                    "Invalid product price"
            }), 400

        if price < 0:

            return jsonify({
                "error":
                    "Price cannot be negative"
            }), 400

        # ----------------------------------------------------
        # IMAGE
        # ----------------------------------------------------

        media_url = DEFAULT_IMG

        uploaded_file = (
            request.files.get(
                "productImage"
            )
            or request.files.get(
                "image"
            )
        )

        if uploaded_file:

            print(
                "Uploaded image:",
                uploaded_file.filename
            )

            print(
                "Image content type:",
                uploaded_file.content_type
            )

        # ----------------------------------------------------
        # CLOUDINARY
        # ----------------------------------------------------

        cloud_name = os.getenv(
            "CLOUDINARY_CLOUD_NAME"
        )

        cloud_api_key = os.getenv(
            "CLOUDINARY_API_KEY"
        )

        cloud_api_secret = os.getenv(
            "CLOUDINARY_API_SECRET"
        )

        cloudinary_available = all([
            cloud_name,
            cloud_api_key,
            cloud_api_secret
        ])

        if (
            uploaded_file
            and uploaded_file.filename
            and cloudinary_available
        ):

            try:

                import cloudinary
                import cloudinary.uploader

                cloudinary.config(
                    cloud_name=cloud_name,
                    api_key=cloud_api_key,
                    api_secret=cloud_api_secret,
                    secure=True
                )

                upload_result = (
                    cloudinary.uploader.upload(
                        uploaded_file,
                        folder="bizspark/products",
                        resource_type="image"
                    )
                )

                media_url = (
                    upload_result.get(
                        "secure_url"
                    )
                    or DEFAULT_IMG
                )

                print(
                    "Cloudinary upload successful"
                )

            except Exception as upload_error:

                print(
                    "CLOUDINARY ERROR:",
                    repr(upload_error)
                )

                # Product publication should still work.
                media_url = DEFAULT_IMG

        elif uploaded_file:

            print(
                "Cloudinary is not configured."
            )

            print(
                "Using default product image."
            )

        # ----------------------------------------------------
        # SAVE PRODUCT
        # ----------------------------------------------------

        product_id = (
            "prod_" +
            uuid.uuid4().hex
        )

        created_at = (
            time.strftime(
                "%Y-%m-%dT%H:%M:%SZ",
                time.gmtime()
            )
        )

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

        return jsonify({
            "error":
                "Failed to publish product",
            "details":
                str(error)
        }), 500


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

            db.commit()

            deleted =
                cursor.rowcount

        if deleted == 0:

            return jsonify({
                "error":
                    "Product not found"
            }), 404

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

        return jsonify({
            "error":
                "Failed to delete product",
            "details":
                str(error)
        }), 500


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

        data =
            request.get_json(
                silent=True
            ) or {}

        customer_name = (
            data.get(
                "customerName"
            ) or ""
        ).strip()

        email = (
            data.get(
                "email"
            ) or ""
        ).strip()

        items =
            data.get("items") or []

        if not customer_name:

            return jsonify({
                "error":
                    "Customer name is required"
            }), 400

        if not email:

            return jsonify({
                "error":
                    "Customer email is required"
            }), 400

        if (
            not isinstance(items, list)
            or not items
        ):

            return jsonify({
                "error":
                    "Order contains no items"
            }), 400

        amount = 0.0

        for item in items:

            try:

                product_id =
                    str(
                        item.get("id")
                    )

                quantity =
                    int(
                        item.get(
                            "qty",
                            0
                        )
                    )

                if quantity <= 0:
                    continue

                # IMPORTANT:
                # Get the actual product price
                # from the database.
                with get_db() as db:

                    product =
                        db.execute(
                            """
                            SELECT price
                            FROM products
                            WHERE id = ?
                            """,
                            (product_id,)
                        ).fetchone()

                if not product:
                    continue

                actual_price =
                    float(
                        product["price"]
                    )

                amount += (
                    actual_price *
                    quantity
                )

            except (
                ValueError,
                TypeError
            ):
                continue

        if amount <= 0:

            return jsonify({
                "error":
                    "Invalid order total"
            }), 400

        order_id = (
            "order_" +
            uuid.uuid4().hex
        )

        date = (
            time.strftime(
                "%Y-%m-%dT%H:%M:%SZ",
                time.gmtime()
            )
        )

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

        return jsonify({
            "error":
                "Failed to create order",
            "details":
                str(error)
        }), 500


# ============================================================
# DASHBOARD
============================================================

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
                SELECT *
                FROM orders
                ORDER BY date DESC
                """
            ).fetchall()

        return jsonify({
            "transactions":
                [dict(row) for row in orders]
        }), 200

    except Exception as error:

        print(
            "DASHBOARD ERROR:",
            repr(error)
        )

        return jsonify({
            "error":
                "Failed to load dashboard data",
            "details":
                str(error)
        }), 500


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