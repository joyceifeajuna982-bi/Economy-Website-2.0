import os
import uuid
from flask import Flask, request, jsonify, render_template, url_for
from flask_cors import CORS
import cloudinary
import cloudinary.uploader

app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests (frontend/backend hosted separately)

# =========================================================
# CONFIG
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5MB limit

DEFAULT_IMG = (
    "https://images.unsplash.com/"
    "photo-1523275335684-37898b6baf30"
    "?w=600&auto=format&fit=crop&q=60"
)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

# Configure Cloudinary if credentials exist in environment variables
CLOUDINARY_URL = os.environ.get("CLOUDINARY_URL")
if CLOUDINARY_URL:
    cloudinary.config(cloudinary_url=CLOUDINARY_URL)

# =========================================================
# DATABASE (IN-MEMORY)
# =========================================================

products_db = []
orders_db = []

# =========================================================
# HELPERS
# =========================================================

def clean_text(text):
    if not text:
        return ""
    return str(text).strip()

def allowed_file(filename):
    if not filename or "." not in filename:
        return False
    extension = filename.rsplit(".", 1)[1].lower()
    return extension in ALLOWED_EXTENSIONS

# =========================================================
# ROUTES
# =========================================================

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/products", methods=["GET"])
def get_products():
    return jsonify(products_db), 200

@app.route("/api/products", methods=["POST"])
def add_product():
    try:
        product_name = clean_text(request.form.get("productName"))
        category = clean_text(request.form.get("category"))
        business_name = clean_text(request.form.get("businessName"))
        description = clean_text(request.form.get("description"))
        price = clean_text(request.form.get("price"))

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

        image = request.files.get("image")
        media_url = DEFAULT_IMG

        if image and image.filename:
            if not allowed_file(image.filename):
                return jsonify({
                    "success": False,
                    "error": "Only JPG, JPEG, PNG and WebP images are allowed."
                }), 400

            # Upload to Cloudinary if configured; otherwise use local disk
            if CLOUDINARY_URL:
                upload_result = cloudinary.uploader.upload(image)
                media_url = upload_result.get("secure_url", DEFAULT_IMG)
            else:
                extension = image.filename.rsplit(".", 1)[1].lower()
                filename = f"{uuid.uuid4().hex}.{extension}"
                filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
                image.save(filepath)
                media_url = url_for("static", filename=f"uploads/{filename}")

        new_product = {
            "id": str(uuid.uuid4()),
            "productName": product_name,
            "category": category or "General",
            "businessName": business_name or "BizSpark Shop",
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

@app.route("/api/orders", methods=["POST"])
def create_order():
    try:
        data = request.get_json() or {}
        customer_name = clean_text(data.get("customerName"))
        email = clean_text(data.get("email"))
        items = data.get("items", [])

        if not customer_name or not email:
            return jsonify({
                "success": False,
                "error": "Customer name and email are required."
            }), 400

        total_amount = sum(
            float(item.get("price", 0)) * int(item.get("qty", 1))
            for item in items
        )

        order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
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
        print("ORDER ERROR:", error)
        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

@app.route("/api/dashboard", methods=["GET"])
def get_dashboard():
    return jsonify({
        "success": True,
        "transactions": orders_db,
        "products": products_db
    }), 200

# =========================================================
# RUN SERVER
# =========================================================

if __name__ == "__main__":
    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )