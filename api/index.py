import os
import sqlite3
import time
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

DB_NAME = "/tmp/bizspark.db" if os.getenv('VERCEL') else "bizspark.db"
DEFAULT_IMG = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    try:
        with get_db() as db:
            db.execute('''
                CREATE TABLE IF NOT EXISTS products (
                    id TEXT PRIMARY KEY, businessName TEXT, productName TEXT, 
                    price REAL, description TEXT, category TEXT, mediaUrl TEXT, createdAt TEXT
                )
            ''')
            db.execute('''
                CREATE TABLE IF NOT EXISTS orders (
                    id TEXT PRIMARY KEY, customerName TEXT, email TEXT, 
                    amount REAL, status TEXT, date TEXT
                )
            ''')
            cursor = db.execute("PRAGMA table_info(products)")
            columns = [column[1] for column in cursor.fetchall()]
            if 'category' not in columns:
                db.execute('ALTER TABLE products ADD COLUMN category TEXT')
            if 'mediaUrl' not in columns:
                db.execute('ALTER TABLE products ADD COLUMN mediaUrl TEXT')
            if 'createdAt' not in columns:
                db.execute('ALTER TABLE products ADD COLUMN createdAt TEXT')
            db.commit()
    except Exception as e:
        print("Database initialization error:", e)

init_db()

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
    return response

@app.route('/api/products', methods=['GET', 'OPTIONS'])
def get_products():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        init_db()
        with get_db() as db:
            rows = db.execute('SELECT * FROM products ORDER BY createdAt DESC').fetchall()
        return jsonify([dict(row) for row in rows]), 200
    except Exception as e:
        return jsonify({"error": "Failed to fetch products", "details": str(e)}), 500

@app.route('/api/products', methods=['POST', 'OPTIONS'])
def add_product():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        init_db()
        p_id = "prod_" + str(int(time.time() * 1000))
        data = request.form if request.form else (request.get_json(silent=True) or {})

        # Accept productName, name, or title as fallback
        product_name = (data.get('productName') or data.get('name') or data.get('title') or '').strip()
        if not product_name:
            return jsonify({"error": "Product name is required"}), 400

        media_url = DEFAULT_IMG
        file = request.files.get('productImage') or request.files.get('image')

        # Safely attempt Cloudinary upload
        if file and file.filename != '':
            try:
                import cloudinary
                import cloudinary.uploader
                cloudinary.config(
                    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME', 'cuwkypxg'),
                    api_key=os.getenv('CLOUDINARY_API_KEY', '545112641637365'),
                    api_secret=os.getenv('CLOUDINARY_API_SECRET', 'hOq22SW3KzODDKL-AU_RuYcKEuE')
                )
                upload_result = cloudinary.uploader.upload(file)
                media_url = upload_result.get('secure_url', DEFAULT_IMG)
            except Exception as upload_err:
                print("Cloudinary upload failed, falling back to default image:", upload_err)

        category = data.get('category') or data.get('productCategory') or 'General'
        try:
            price = float(data.get('price', 0.0))
        except (ValueError, TypeError):
            price = 0.0

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
    if request.method == 'OPTIONS':
        return '', 200
    try:
        init_db()
        with get_db() as db:
            db.execute('DELETE FROM products WHERE id = ?', (p_id,))
            db.commit()
        return jsonify({"message": "Product deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": "Failed to delete product", "details": str(e)}), 500

@app.route('/api/dashboard', methods=['GET', 'OPTIONS'])
def get_dashboard():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        init_db()
        with get_db() as db:
            orders = db.execute('SELECT * FROM orders ORDER BY date DESC').fetchall()
        return jsonify({"transactions": [dict(row) for row in orders]}), 200
    except Exception as e:
        return jsonify({"error": "Failed to load dashboard data", "details": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)