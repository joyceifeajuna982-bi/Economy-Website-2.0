import os
import re
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# Default image placeholder URL
DEFAULT_IMG = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=60"

# In-memory database representation
products_db = []

def clean_text(text):
    """Trims whitespace and handles empty strings."""
    if not text:
        return ""
    return str(text).strip()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/products", methods=["GET"])
def get_products():
    """Returns the list of all products."""
    return jsonify({"success": True, "products": products_db}), 200

@app.route("/api/products", methods=["POST"])
def add_product():
    """Adds a new product to the database."""
    try:
        # Get data from JSON or form submissions
        data = request.get_json(silent=True) or request.form

        product_name = clean_text(data.get("productName"))
        category = clean_text(data.get("category"))
        shop_name = clean_text(data.get("shopName"))
        description = clean_text(data.get("description"))
        price = clean_text(data.get("price"))
        
        # Extract mediaUrl and fallback only if empty
        media_url = clean_text(data.get("mediaUrl"))
        if not media_url:
            media_url = DEFAULT_IMG

        if not product_name or not price:
            return jsonify({"success": False, "error": "Product name and price are required."}), 400

        new_product = {
            "id": str(len(products_db) + 1),
            "productName": product_name,
            "category": category or "General",
            "shopName": shop_name or "BizSpark Shop",
            "description": description,
            "price": price,
            "mediaUrl": media_url
        }

        products_db.append(new_product)
        return jsonify({"success": True, "product": new_product}), 201

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)