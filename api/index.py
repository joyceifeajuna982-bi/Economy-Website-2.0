import os
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
import cloudinary
import cloudinary.uploader

app = Flask(__name__)

CORS(app, resources={
    r"/api/*": {
        "origins": "*"
    }
})

# =========================================================
# CONFIG
# =========================================================

app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

DEFAULT_IMG = (
    "https://images.unsplash.com/"
    "photo-1523275335684-37898b6baf30"
    "?w=800&auto=format&fit=crop&q=80"
)

ALLOWED_EXTENSIONS = {
    "jpg",
    "jpeg",
    "png",
    "webp"
}

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
}

# =========================================================
# CLOUDINARY
# =========================================================

CLOUDINARY_URL = os.environ.get("CLOUDINARY_URL")

if CLOUDINARY_URL:
    cloudinary.config(
        cloudinary_url=CLOUDINARY_URL
    )

# =========================================================
# DATABASE
# =========================================================

products_db = []
orders_db = []

# =========================================================
# HELPERS
# =========================================================

def clean_text(value):
    if value is None:
        return ""

    return str(value).strip()


def allowed_file(filename):
    if not filename:
        return False

    if "." not in filename:
        return False

    extension = filename.rsplit(".", 1)[1].lower()

    return extension in ALLOWED_EXTENSIONS


def upload_image_to_cloudinary(image):
    """
    Uploads the selected image directly to Cloudinary
    and returns the permanent HTTPS URL.
    """

    if not CLOUDINARY_URL:
        raise RuntimeError(
            "Cloudinary is not configured on the server. "
            "Please add CLOUDINARY_URL to Vercel Environment Variables."
        )

    result = cloudinary.uploader.upload(
        image,
        folder="bizspark/products",
        resource_type="image",
        use_filename=True,
        unique_filename=True,
        overwrite=False
    )

    secure_url = result.get("secure_url")

    if not secure_url:
        raise RuntimeError(
            "Cloudinary uploaded the image but did not return a secure URL."
        )

    return secure_url


# =========================================================
# HEALTH CHECK
# =========================================================

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "success": True,
        "cloudinaryConfigured": bool(CLOUDINARY_URL),
        "message": "BizSpark API is running."
    }), 200


# =========================================================
# PRODUCTS - GET
# =========================================================

@app.route("/api/products", methods=["GET"])
def get_products():
    return jsonify(products_db), 200


# =========================================================
# PRODUCTS - POST
# =========================================================

@app.route("/api/products", methods=["POST"])
def add_product():

    try:

        # -------------------------------------------------
        # READ FORM DATA
        # -------------------------------------------------

        product_name = clean_text(
            request.form.get("productName")
        )

        category = clean_text(
            request.form.get("category")
        )

        business_name = clean_text(
            request.form.get("businessName")
        )

        description = clean_text(
            request.form.get("description")
        )

        price_text = clean_text(
            request.form.get("price")
        )

        # -------------------------------------------------
        # VALIDATION
        # -------------------------------------------------

        if not product_name:

            return jsonify({
                "success": False,
                "error": "Product name is required."
            }), 400

        if not price_text:

            return jsonify({
                "success": False,
                "error": "Product price is required."
            }), 400

        try:
            price = float(price_text)

        except (TypeError, ValueError):

            return jsonify({
                "success": False,
                "error": "Product price must be a valid number."
            }), 400

        if price < 0:

            return jsonify({
                "success": False,
                "error": "Product price cannot be negative."
            }), 400

        # -------------------------------------------------
        # IMAGE
        # -------------------------------------------------

        image = request.files.get("image")

        media_url = DEFAULT_IMG

        if image and image.filename:

            # Check filename
            if not allowed_file(image.filename):

                return jsonify({
                    "success": False,
                    "error": (
                        "Only JPG, JPEG, PNG and WebP "
                        "images are allowed."
                    )
                }), 400

            # Check MIME type
            if image.mimetype not in ALLOWED_MIME_TYPES:

                return jsonify({
                    "success": False,
                    "error": "Invalid image type."
                }), 400

            # Make sure the file isn't empty
            image.seek(0, os.SEEK_END)
            file_size = image.tell()
            image.seek(0)

            if file_size <= 0:

                return jsonify({
                    "success": False,
                    "error": "The selected image is empty."
                }), 400

            if file_size > 5 * 1024 * 1024:

                return jsonify({
                    "success": False,
                    "error": "Image must be smaller than 5MB."
                }), 400

            # -------------------------------------------------
            # CLOUDINARY UPLOAD
            # -------------------------------------------------

            media_url = upload_image_to_cloudinary(image)

        # -------------------------------------------------
        # CREATE PRODUCT
        # -------------------------------------------------

        new_product = {
            "id": str(uuid.uuid4()),
            "productName": product_name,
            "category": category or "General",
            "businessName": business_name or "BizSpark Shop",
            "description": description,
            "price": price,
            "mediaUrl": media_url,
            "image": media_url
        }

        products_db.append(new_product)

        # -------------------------------------------------
        # RESPONSE
        # -------------------------------------------------

        return jsonify({
            "success": True,
            "message": "Product published successfully.",
            "product": new_product
        }), 201

    except Exception as error:

        print("PRODUCT ERROR:", repr(error))

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500


# =========================================================
# ORDERS
# =========================================================

@app.route("/api/orders", methods=["POST"])
def create_order():

    try:

        data = request.get_json(silent=True) or {}

        customer_name = clean_text(
            data.get("customerName")
        )

        email = clean_text(
            data.get("email")
        )

        items = data.get("items", [])

        if not customer_name or not email:

            return jsonify({
                "success": False,
                "error": "Customer name and email are required."
            }), 400

        if not isinstance(items, list):

            return jsonify({
                "success": False,
                "error": "Invalid order items."
            }), 400

        total_amount = 0

        for item in items:

            try:

                item_price = float(
                    item.get("price", 0)
                )

                item_qty = int(
                    item.get("qty", 1)
                )

                if item_qty < 1:
                    item_qty = 1

                total_amount += (
                    item_price * item_qty
                )

            except (TypeError, ValueError):

                return jsonify({
                    "success": False,
                    "error": "Invalid product price or quantity."
                }), 400

        order_id = (
            f"ORD-{uuid.uuid4().hex[:8].upper()}"
        )

        new_order = {
            "id": order_id,
            "customerName": customer_name,
            "email": email,
            "amount": total_amount,
            "status": "Completed",
            "items": items
        }

        orders_db.append(new_order)

        return jsonify({
            "success": True,
            "orderId": order_id,
            "order": new_order
        }), 201

    except Exception as error:

        print("ORDER ERROR:", repr(error))

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500


# =========================================================
# DASHBOARD
# =========================================================

@app.route("/api/dashboard", methods=["GET"])
def get_dashboard():

    return jsonify({
        "success": True,
        "transactions": orders_db,
        "products": products_db
    }), 200


# =========================================================
# ERROR HANDLERS
# =========================================================

@app.errorhandler(413)
def file_too_large(error):

    return jsonify({
        "success": False,
        "error": "Image is too large. Maximum size is 5MB."
    }), 413


@app.errorhandler(500)
def internal_server_error(error):

    return jsonify({
        "success": False,
        "error": "Internal server error."
    }), 500


# =========================================================
# LOCAL DEVELOPMENT
# =========================================================

if __name__ == "__main__":

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )