from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import csv
import uuid
import logging
import bcrypt
import jwt as pyjwt
import pandas as pd
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict


# --- Config ---
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
JWT_EXPIRE_HOURS = 24 * 7  # 7 days
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Pankaj Mill Stores API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pms")


# --- Helpers ---
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


# --- Models ---
class LoginBody(BaseModel):
    username: str
    password: str


class UserPublic(BaseModel):
    id: str
    username: str
    role: Literal["admin", "viewer"]
    created_at: str


class LoginResponse(BaseModel):
    token: str
    user: UserPublic


class ProductIn(BaseModel):
    name: str
    brand: str = ""
    size: str = ""
    category: str = ""
    wholesale_price: float = 0
    retail_price: float = 0


class ProductPatch(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    size: Optional[str] = None
    category: Optional[str] = None
    wholesale_price: Optional[float] = None
    retail_price: Optional[float] = None


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    brand: str = ""
    size: str = ""
    category: str = ""
    wholesale_price: float = 0
    retail_price: float = 0
    updated_at: str
    created_at: str


class CreateUserBody(BaseModel):
    username: str
    password: str
    role: Literal["admin", "viewer"] = "viewer"


# --- Auth Endpoints ---
@api.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginBody):
    uname = body.username.strip().lower()
    user = await db.users.find_one({"username": uname})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid username or password")
    token = create_token(user["id"], user["username"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "created_at": user["created_at"],
        },
    }


@api.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "created_at": user["created_at"],
    }


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# --- Product Endpoints ---
@api.get("/products")
async def list_products(
    q: Optional[str] = None,
    brand: Optional[str] = None,
    size: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if q:
        # case-insensitive regex across key fields
        safe = q.strip()
        if safe:
            rx = {"$regex": safe, "$options": "i"}
            query["$or"] = [
                {"name": rx},
                {"brand": rx},
                {"size": rx},
                {"category": rx},
            ]
    if brand:
        query["brand"] = brand
    if size:
        query["size"] = size
    if category:
        query["category"] = category
    cursor = db.products.find(query, {"_id": 0}).sort("name", 1).skip(skip).limit(min(limit, 200))
    items = await cursor.to_list(length=min(limit, 200))
    total = await db.products.count_documents(query)
    return {"items": items, "total": total}


@api.get("/products/facets")
async def facets(user: dict = Depends(get_current_user)):
    brands = await db.products.distinct("brand")
    sizes = await db.products.distinct("size")
    categories = await db.products.distinct("category")
    total = await db.products.count_documents({})
    return {
        "brands": sorted([b for b in brands if b]),
        "sizes": sorted([s for s in sizes if s]),
        "categories": sorted([c for c in categories if c]),
        "total": total,
    }


@api.get("/products/export")
async def export_csv(user: dict = Depends(require_admin)):
    cursor = db.products.find({}, {"_id": 0}).sort("name", 1)
    rows = await cursor.to_list(length=100000)
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["Product Name", "Brand", "Size", "Category", "Wholesale Price", "Retail Price"])
    for r in rows:
        writer.writerow([
            r.get("name", ""), r.get("brand", ""), r.get("size", ""),
            r.get("category", ""), r.get("wholesale_price", 0), r.get("retail_price", 0),
        ])
    out.seek(0)
    return StreamingResponse(
        iter([out.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pankaj_catalog.csv"},
    )


@api.post("/products")
async def create_product(body: ProductIn, user: dict = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "brand": body.brand.strip(),
        "size": body.size.strip(),
        "category": body.category.strip(),
        "wholesale_price": float(body.wholesale_price or 0),
        "retail_price": float(body.retail_price or 0),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    if not doc["name"]:
        raise HTTPException(400, "Product name is required")
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/products/{product_id}")
async def update_product(product_id: str, body: ProductPatch, user: dict = Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No changes")
    for k in ("name", "brand", "size", "category"):
        if k in updates and isinstance(updates[k], str):
            updates[k] = updates[k].strip()
    for k in ("wholesale_price", "retail_price"):
        if k in updates:
            updates[k] = float(updates[k])
    updates["updated_at"] = now_iso()
    result = await db.products.update_one({"id": product_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Product not found")
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    return doc


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_admin)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return {"ok": True}


@api.post("/products/bulk")
async def bulk_upload(
    file: UploadFile = File(...),
    mode: str = Form("update"),  # "replace" or "update"
    user: dict = Depends(require_admin),
):
    if mode not in ("replace", "update"):
        raise HTTPException(400, "mode must be 'replace' or 'update'")
    content = await file.read()
    name = (file.filename or "").lower()
    try:
        if name.endswith(".xlsx") or name.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content))
        else:
            df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")

    # Normalize column names
    cols_map = {c: c.strip().lower() for c in df.columns}
    df = df.rename(columns=cols_map)

    def pick(row, *keys):
        for k in keys:
            if k in row and pd.notna(row[k]):
                return row[k]
        return ""

    parsed = []
    errors = []
    for idx, row in df.iterrows():
        name_v = str(pick(row, "product name", "name", "product") or "").strip()
        if not name_v:
            errors.append({"row": int(idx) + 2, "error": "missing product name"})
            continue
        try:
            wp = float(pick(row, "wholesale price", "wholesale", "wholesale_price") or 0)
        except Exception:
            wp = 0
        try:
            rp = float(pick(row, "retail price", "retail", "retail_price") or 0)
        except Exception:
            rp = 0
        parsed.append({
            "name": name_v,
            "brand": str(pick(row, "brand") or "").strip(),
            "size": str(pick(row, "size", "variant", "size/variant") or "").strip(),
            "category": str(pick(row, "category") or "").strip(),
            "wholesale_price": wp,
            "retail_price": rp,
        })

    inserted = 0
    updated = 0
    if mode == "replace":
        await db.products.delete_many({})
        docs = []
        for p in parsed:
            docs.append({
                **p,
                "id": str(uuid.uuid4()),
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        if docs:
            await db.products.insert_many(docs)
        inserted = len(docs)
    else:
        # Update existing by (name+brand+size) key, else insert
        for p in parsed:
            key = {"name": p["name"], "brand": p["brand"], "size": p["size"]}
            existing = await db.products.find_one(key)
            if existing:
                await db.products.update_one(
                    {"id": existing["id"]},
                    {"$set": {**p, "updated_at": now_iso()}},
                )
                updated += 1
            else:
                await db.products.insert_one({
                    **p,
                    "id": str(uuid.uuid4()),
                    "created_at": now_iso(),
                    "updated_at": now_iso(),
                })
                inserted += 1

    return {"inserted": inserted, "updated": updated, "errors": errors[:50], "total_rows": len(parsed)}


# --- User (viewer) Management ---
@api.get("/users")
async def list_users(user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("username", 1).to_list(500)
    return users


@api.post("/users")
async def create_user(body: CreateUserBody, user: dict = Depends(require_admin)):
    uname = body.username.strip().lower()
    if not uname or not body.password:
        raise HTTPException(400, "Username and password required")
    existing = await db.users.find_one({"username": uname})
    if existing:
        raise HTTPException(400, "Username already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "username": uname,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return {"id": doc["id"], "username": doc["username"], "role": doc["role"], "created_at": doc["created_at"]}


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


# --- App wiring ---
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    # Indexes
    try:
        await db.users.create_index("username", unique=True)
        await db.users.create_index("id", unique=True)
        await db.products.create_index("id", unique=True)
        await db.products.create_index([("name", 1)])
        await db.products.create_index([("brand", 1)])
        await db.products.create_index([("category", 1)])
        # Text index for search (fallback; we mainly use regex $or above)
        try:
            await db.products.create_index([
                ("name", "text"), ("brand", "text"),
                ("size", "text"), ("category", "text"),
            ])
        except Exception as e:
            logger.warning(f"text index skip: {e}")
    except Exception as e:
        logger.warning(f"index create issue: {e}")

    # Seed admin
    admin = await db.users.find_one({"username": ADMIN_USERNAME.lower()})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": ADMIN_USERNAME.lower(),
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info(f"Seeded admin user: {ADMIN_USERNAME}")
    else:
        # If env password differs, update it (idempotent seed)
        if not verify_password(ADMIN_PASSWORD, admin["password_hash"]):
            await db.users.update_one(
                {"id": admin["id"]},
                {"$set": {"password_hash": hash_password(ADMIN_PASSWORD), "role": "admin"}},
            )
            logger.info("Updated admin password from env")


@app.on_event("shutdown")
async def shutdown():
    client.close()


@api.get("/")
async def root():
    return {"app": "Pankaj Mill Stores API", "ok": True}
