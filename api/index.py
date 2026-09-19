import os
import sqlite3
import time
from flask import Flask, jsonify, request
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)

# Enable Flask-CORS across all routes
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Use Vercel's writable /tmp directory for SQLite, or fallback to local file
DB_NAME = "/tmp/bizspark.db" if os.getenv('VERCEL') else "bizspark.db"
DEFAULT_IMG = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"

# Setup Cloudinary if credentials exist in environment
CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', 'cuwkypxg')
API_KEY = os.getenv('CLOUDINARY_API_KEY', '545112641637365')
API_SECRET = os.getenv('CLOUDINARY_API_SECRET', 'hOq22SW3KzODDKL-AU_RuYcKEuE')

has_cloudinary = False
if API_SECRET:
    try:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=CLOUD_NAME,
            api_key=API_KEY,
            api_secret=API_SECRET
        )
        has_cloudinary = True
    except Exception as e:
        print("Cloudinary init warning:", e)


def get_db():
    """Establish database connection with Row factory."""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database tables safely inside writable /tmp space."""
    try:
        with get_db() as db:
            db.execute('''
                CREATE TABLE IF NOT EXISTS products (
                    id TEXT PRIMARY KEY, 
                    businessName TEXT, 
                    productName TEXT, 
                    price REAL, 
                    description TEXT, 
                    category TEXT, 
                    mediaUrl TEXT, 
                    createdAt TEXT
                )
            ''')
            db.execute('''
                CREATE TABLE IF NOT EXISTS orders (
                    id TEXT PRIMARY KEY, 
                    customerName TEXT, 
                    email TEXT, 
                    amount REAL, 
                    status TEXT, 
                    date TEXT
                )
            ''')
            db.commit()
    except Exception as e:
        print("Database initialization error:", e)


@app.before_request
def before_request_check():
    """Ensure database tables exist before handling incoming requests."""
    init_db()


@app.after_request
def add_cors_headers(response):
    """Inject required CORS headers into every response to prevent browser blocks."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
    return response


@app.route('/api/products', methods=['GET', 'OPTIONS'])
def get_products():
    """Fetch all products ordered by creation date."""
    if request.method == 'OPTIONS':
        return '', 200

    try:
        with get_db() as db:
            rows = db.execute('SELECT * FROM products ORDER BY createdAt DESC').fetchall()
        return jsonify([dict(row) for row in rows]), 200
    except Exception as e:
        print("Error fetching products:", e)
        return jsonify({"error": "Failed to fetch products", "details": str(e)}), 500


@app.route('/api/products', methods=['POST', 'OPTIONS'])
def add_product():
    """Add a new product with optional image upload."""
    if request.method == 'OPTIONS':
        return '', 200

    try:
        p_id = "prod_" + str(int(time.time() * 1000))
        data = request.form

        product_name = data.get('productName', '').strip()
        if not product_name:
            return jsonify({"error": "Product name is required"}), 400

        # Handle image upload
        media_url = DEFAULT_IMG
        file = request.files.get('productImage') or request.files.get('image')

        if file and file.filename != '' and has_cloudinary:
            try:
                upload_result = cloudinary.uploader.upload(file)
                media_url = upload_result.get('secure_url', DEFAULT_IMG)
            except Exception as upload_err:
                print("Cloudinary upload error:", upload_err)

        category = data.get('category') or data.get('productCategory') or 'General'
        price = float(data.get('price', 0.0))
        biz_name = data.get('businessName', 'Merchant')
        desc = data.get('description', '')
        created_at = time.strftime('%Y-%m-%dT%H:%M:%SZ')

        with get_db() as db:
            db.execute('''
                INSERT INTO products (id, businessName, productName, price, description, category, mediaUrl, createdAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (p_id, biz_name, product_name, price, desc, category, media_url, created_at))
            db.commit()

        return jsonify({
            "id": p_id,
            "message": "Product published successfully",
            "mediaUrl": media_url
        }), 201

    except Exception as e:
        print("Error adding product:", e)
        return jsonify({"error": "Failed to publish product", "details": str(e)}), 500


@app.route('/api/products/<p_id>', methods=['DELETE', 'OPTIONS'])
def delete_product(p_id):
    """Delete a product by ID."""
    if request.method == 'OPTIONS':
        return '', 200

    try:
        with get_db() as db:
            db.execute('DELETE FROM products WHERE id = ?', (p_id,))
            db.commit()
        return jsonify({"message": "Product deleted successfully"}), 200
    except Exception as e:
        print("Error deleting product:", e)
        return jsonify({"error": "Failed to delete product", "details": str(e)}), 500


@app.route('/api/dashboard', methods=['GET', 'OPTIONS'])
def get_dashboard():
    """Retrieve transaction/order records."""
    if request.method == 'OPTIONS':
        return '', 200

    try:
        with get_db() as db:
            orders = db.execute('SELECT * FROM orders ORDER BY date DESC').fetchall()
        return jsonify({"transactions": [dict(row) for row in orders]}), 200
    except Exception as e:
        print("Error fetching dashboard:", e)
        return jsonify({"error": "Failed to load dashboard data", "details": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
    