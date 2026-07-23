# Pankaj Mill Stores — Price Lookup App (PRD)

## Original Problem Statement
Internal web app for Pankaj Mill Stores focused on two priorities:
1. **Effortless price lookup** — big search bar, instant autocomplete, large Wholesale ₹ / Retail ₹ display, filters (brand/size/category), mobile-friendly.
2. **Effortless price editing (admin)** — inline click-to-edit, save on Enter/blur, bulk CSV upload, always-visible "Add New Product".

Role-based: Admin (full access) vs Team Viewers (search only). Text-only branding + faint centered watermark. Currency INR ₹ only. No inventory. Internal use.

## Architecture
- **Backend:** FastAPI + Motor + MongoDB, JWT (Bearer) auth, bcrypt password hashing, PyJWT tokens (7d expiry). All routes under `/api`.
- **Frontend:** React (CRA + craco) + Tailwind + shadcn/ui + sonner toasts + lucide-react icons.
- **Fonts:** Chivo (heading, font-black) + IBM Plex Sans/Mono (body/labels). Rust orange primary on warm stone background. Sharp industrial edges (radius 0-2px).
- **Storage:** MongoDB collections — `users` (unique username), `products` (id, name, brand, size, category, wholesale_price, retail_price, created_at, updated_at).

## User Personas
- **Main Admin** — shop owner; manages catalog, uploads CSV, manages team accounts.
- **Team Viewer** — staff at shop/warehouse; searches prices only.

## Core Requirements (static)
- Search across name/brand/size/category (case-insensitive)
- Inline price edit for admin (no forms/modals)
- CSV/Excel bulk upload: modes = `update` (merge on name+brand+size) or `replace` (wipe & repopulate)
- CSV export of full catalog
- Team viewer account CRUD (admin only)
- Faint centered "PANKAJ MILL STORES" watermark

## What's Been Implemented (2026-02)
- ✅ JWT-based username/password auth with admin seeding from env
- ✅ Product model + CRUD endpoints with regex search + facet endpoint
- ✅ Bulk CSV/Excel upload (pandas) with update/replace modes
- ✅ CSV export endpoint
- ✅ User management endpoints (list/create/delete, admin only)
- ✅ Role-based access (viewer read-only vs admin full)
- ✅ Login page (industrial aesthetic)
- ✅ Search page with instant autocomplete (debounced), filters, add-product inline modal
- ✅ Admin panel: Products table (all fields inline-editable), Upload/Export, Team management
- ✅ Watermark + noise texture background
- ✅ Tested via testing_agent_v3 (backend 17/17, frontend core flows all pass)

## Prioritized Backlog
### P1
- Price change history / audit log (who changed what, when)
- Bulk % price update by brand (e.g., +5% across "Tata")
- Similar products grouping (same name, multiple brands/sizes) on search results

### P2
- Barcode scanner for lookup (camera on mobile)
- Activity log (viewer search history)
- Password reset for viewers via admin
- Dark mode

## Test Credentials
See `/app/memory/test_credentials.md`
- Admin: `admin` / `admin123`

## Notes
- Backend env: `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `MONGO_URL`, `DB_NAME`
- Frontend uses `REACT_APP_BACKEND_URL` and stores token in `localStorage['pms_token']`
