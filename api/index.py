import os
import re
import sqlite3
import time
import uuid
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

DEFAULT_IMG = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800"

# Safe read/write database location for Vercel serverless functions
DB_NAME = "/tmp/bizspark.db"

def get_db():
    connection = sqlite3.connect(DB_NAME, timeout=20)
    connection.row_factory = sqlite3.Row
    return connection

def init_db():
    with get_db() as db:
        db.execute("""
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
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                customerName TEXT NOT NULL,
                email TEXT NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                date TEXT NOT NULL
            )
        """)
        db.commit()

init_db()

@app.route("/api", methods=["GET"])
def api_home():
    return jsonify({"ok": True, "service": "BizSpark API", "version": "1.0.0"})

@app.route("/api/health", methods=["GET"])
def health():
    try:
        init_db()
        return jsonify({"ok": True, "database": DB_NAME})
    except Exception as error:
        return jsonify({"error": "Database health check failed", "details": str(error)}), 500

@app.route("/api/products", methods=["GET", "OPTIONS"])
def get_products():
    if request.method == "OPTIONS":
        return "", 204
    try:
        init_db()
        with get_db() as db:
            rows = db.execute(
                "SELECT id, businessName, productName, price, description, category, mediaUrl, createdAt FROM products ORDER BY createdAt DESC"
            ).fetchall()
        return jsonify([dict(row) for row in rows]), 200
    except Exception as error:
        return jsonify({"error": "Failed to fetch products", "details": str(error)}), 500

@app.route("/api/products", methods=["POST", "OPTIONS"])
def add_product():
    if request.method == "OPTIONS":
        return "", 204
    try:
        init_db()
        product_name = (request.form.get("productName") or "").strip()
        business_name = (request.form.get("businessName") or "Merchant").strip()
        category = (request.form.get("category") or "General").strip()
        description = (request.form.get("description") or "").strip()
        price_raw = (request.form.get("price") or "0").strip()

        if not product_name:
            return jsonify({"error": "Product name is required"}), 400

        try:
            price = round(float(price_raw), 2)
        except ValueError:
            return jsonify({"error": "Invalid product price"}), 400

        product_id = "prod_" + uuid.uuid4().hex
        created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        with get_db() as db:
            db.execute(
                """
                INSERT INTO products (id, businessName, productName, price, description, category, mediaUrl, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (product_id, business_name, product_name, price, description, category, DEFAULT_IMG, created_at)
            )
            db.commit()

        return jsonify({"success": True, "id": product_id, "message": "Product published successfully"}), 201
    except Exception as error:
        return jsonify({"error": "Failed to publish product", "details": str(error)}), 500

@app.route("/api/products/<p_id>", methods=["DELETE", "OPTIONS"])
def delete_product(p_id):
    if request.method == "OPTIONS":
        return "", 204
    try:
        init_db()
        with get_db() as db:
            cursor = db.execute("DELETE FROM products WHERE id = ?", (p_id,))
            deleted = cursor.rowcount
            db.commit()
        if deleted == 0:
            return jsonify({"error": "Product not found"}), 404
        return jsonify({"success": True, "message": "Product deleted successfully"}), 200
    except Exception as error:
        return jsonify({"error": "Failed to delete product", "details": str(error)}), 500

@app.route("/api/orders", methods=["POST", "OPTIONS"])
def create_order():
    if request.method == "OPTIONS":
        return "", 204
    try:
        init_db()
        data = request.get_json(silent=True) or {}
        customer_name = (data.get("customerName") or "").strip()
        email = (data.get("email") or "").strip().lower()
        items = data.get("items") or []

        if not customer_name or not email:
            return jsonify({"error": "Customer name and email are required"}), 400

        total = sum(float(item.get("price", 0)) * int(item.get("qty", 1)) for item in items)
        order_id = "order_" + uuid.uuid4().hex
        date = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        with get_db() as db:
            db.execute(
                "INSERT INTO orders (id, customerName, email, amount, status, date) VALUES (?, ?, ?, ?, ?, ?)",
                (order_id, customer_name, email, round(total, 2), "Pending", date)
            )
            db.commit()

        return jsonify({"success": True, "orderId": order_id, "amount": total}), 201
    except Exception as error:
        return jsonify({"error": "Failed to create order", "details": str(error)}), 500

@app.route("/api/dashboard", methods=["GET", "OPTIONS"])
def get_dashboard():
    if request.method == "OPTIONS":
        return "", 204
    try:
        init_db()
        with get_db() as db:
            orders = db.execute("SELECT id, customerName, email, amount, status, date FROM orders ORDER BY date DESC").fetchall()
        return jsonify({"transactions": [dict(row) for row in orders]}), 200
    except Exception as error:
        return jsonify({"error": "Failed to load dashboard data", "details": str(error)}), 500