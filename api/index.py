import os
import uuid
from flask import Flask, request, jsonify, render_template, url_for

app = Flask(__name__)

# =========================================================
# CONFIG
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER = os.path.join(
    BASE_DIR,
    "static",
    "uploads"
)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

DEFAULT_IMG = (
    "https://images.unsplash.com/"
    "photo-1523275335684-37898b6baf30"
    "?w=600&auto=format&fit=crop&q=60"
)

ALLOWED_EXTENSIONS = {
    "png",
    "jpg",
    "jpeg",
    "webp"
}


# =========================================================
# DATABASE
# =========================================================

products_db = []


# =========================================================
# HELPERS
# =========================================================

def clean_text(text):
    if not text:
        return ""

    return str(text).strip()


def allowed_file(filename):
    if not filename:
        return False

    if "." not in filename:
        return False

    extension = filename.rsplit(".", 1)[1].lower()

    return extension in ALLOWED_EXTENSIONS


# =========================================================
# HOME
# =========================================================

@app.route("/")
def index():
    return render_template("index.html")


# =========================================================
# GET PRODUCTS
# =========================================================

@app.route("/api/products", methods=["GET"])
def get_products():

    return jsonify(products_db), 200


# =========================================================
# ADD PRODUCT
# =========================================================

@app.route("/api/products", methods=["POST"])
def add_product():

    try:

        # -------------------------------------------------
        # PRODUCT INFORMATION
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

        price = clean_text(
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

        if not price:

            return jsonify({
                "success": False,
                "error": "Product price is required."
            }), 400

        # -------------------------------------------------
        # IMAGE
        # -------------------------------------------------

        image = request.files.get("image")

        media_url = DEFAULT_IMG

        if image and image.filename:

            if not allowed_file(image.filename):

                return jsonify({
                    "success": False,
                    "error": "Only JPG, JPEG, PNG and WebP images are allowed."
                }), 400

            # Create a unique filename
            extension = image.filename.rsplit(
                ".",
                1
            )[1].lower()

            filename = (
                f"{uuid.uuid4().hex}.{extension}"
            )

            filepath = os.path.join(
                app.config["UPLOAD_FOLDER"],
                filename
            )

            # Save image
            image.save(filepath)

            # URL the browser can use
            media_url = url_for(
                "static",
                filename=f"uploads/{filename}"
            )

        # -------------------------------------------------
        # CREATE PRODUCT
        # -------------------------------------------------

        new_product = {

            "id": str(uuid.uuid4()),

            "productName": product_name,

            "category": category or "General",

            "businessName":
                business_name or "BizSpark Shop",

            "description": description,

            "price": float(price),

            "mediaUrl": media_url
        }

        products_db.append(new_product)

        return jsonify({
            "success": True,
            "product": new_product
        }), 201

    except Exception as error:

        print("PRODUCT ERROR:", error)

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500


# =========================================================
# RUN SERVER
# =========================================================

if __name__ == "__main__":

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )