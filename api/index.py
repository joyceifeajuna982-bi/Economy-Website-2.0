import os
import sqlite3
import time
from flask import Flask, jsonify, request
from flask_cors import CORS
import cloudinary
import cloudinary.uploader

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

DB_NAME = "bizspark.db"

# Cloudinary Configuration
CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', 'cuwkypxg')
API_KEY = os.getenv('CLOUDINARY_API_KEY', '545112641637365')
API_SECRET = os.getenv('CLOUDINARY_API_SECRET', 'hOq22SW3KzODDKL-AU_RuYcKEuE')

if API_SECRET:
    cloudinary.config(
        cloud_name=CLOUD_NAME,
        api_key=API_KEY,
        api_secret=API_SECRET
    )

DEFAULT_IMG = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
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

@app.route('/api/products', methods=['GET'])
def get_products():
    with get_db() as db:
        rows = db.execute('SELECT * FROM products ORDER BY createdAt DESC').fetchall()
    return jsonify([dict(row) for row in rows])

@app.route('/api/products', methods=['POST'])
def add_product():
    p_id = "prod_" + str(int(time.time() * 1000))
    data = request.form
    
    mediaUrl = DEFAULT_IMG
    
    file = request.files.get('productImage') or request.files.get('image')
    if file and file.filename != '' and API_SECRET:
        try:
            upload_result = cloudinary.uploader.upload(file)
            mediaUrl = upload_result.get('secure_url', DEFAULT_IMG)
        except Exception as e:
            print("Cloudinary upload error:", e)

    category = data.get('category') or data.get('productCategory') or 'General'
    
    with get_db() as db:
        db.execute('''
            INSERT INTO products (id, businessName, productName, price, description, category, mediaUrl, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            p_id, 
            data.get('businessName', 'Merchant'), 
            data.get('productName', ''),
            float(data.get('price', 0.0)), 
            data.get('description', ''),
            category, 
            mediaUrl, 
            time.strftime('%Y-%m-%dT%H:%M:%SZ')
        ))
        db.commit()
    return jsonify({"id": p_id, "message": "Product published", "mediaUrl": mediaUrl}), 201

@app.route('/api/products/<p_id>', methods=['DELETE'])
def delete_product(p_id):
    with get_db() as db:
        db.execute('DELETE FROM products WHERE id = ?', (p_id,))
        db.commit()
    return jsonify({"message": "Product deleted"}), 200

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    with get_db() as db:
        orders = db.execute('SELECT * FROM orders ORDER BY date DESC').fetchall()
    return jsonify({"transactions": [dict(row) for row in orders]})

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
    
    from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
    return "Hello World"