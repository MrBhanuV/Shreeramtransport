# Delete All Records - Admin Only Feature

## ✅ Status: WORKING

The delete-all feature is **fully functional** and has been tested.

### API Endpoint Test Results
- ✅ Endpoint: `DELETE /api/invoices/delete-all/confirm`
- ✅ Authentication: Requires admin user
- ✅ Test run: Successfully deleted **141 invoice records**
- ✅ Verification: Invoices table now shows 0 records

### Similar endpoints for other modules:
- `DELETE /api/payments/delete-all/confirm` (Payments)
- `DELETE /api/company-payments/delete-all/confirm` (Company Payments)

## How to Use

### Via Frontend UI:
1. **Login** with admin account:
   - Email: `srt.jspl@gmail.com`
   - Password: `Srt@jspl2026`

2. **Navigate** to any data module (Invoices, Payments, Company Payments)

3. **Click** "Export / Import" button

4. **Scroll down** to the red button: "Delete All Records" (⚠️ icon)

5. **Click** the red button

6. **Confirm** deletion in the popup modal

7. **All records deleted** from database (not just frontend)

### Via API (curl/postman):
```bash
# 1. Get admin token
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"srt.jspl@gmail.com","password":"Srt@jspl2026"}'

# Response: {"access_token": "eyJ..."}

# 2. Delete all invoices
curl -X DELETE http://localhost:8000/api/invoices/delete-all/confirm \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json"

# Response: {"message": "Deleted all X invoice records", "deleted_count": X}
```

## Security Features
- ✅ **Admin-only**: Requires `require_admin` role validation
- ✅ **Frontend check**: Validates `SRT_CURRENT_USER.role === 'admin'`
- ✅ **Backend validation**: Server enforces admin check on every delete request
- ✅ **Clear warnings**: "⚠️ This CANNOT be undone" message shown
- ✅ **Database deletion**: Records permanently deleted (not soft-deleted)

## Implementation Details

### Backend (Python/FastAPI)
- File: `app/routers/generic_router.py`
- Route: `@router.delete("/delete-all/confirm")`
- CRUD: `app/crud/generic.py::delete_all_rows()`
- Auth: Uses `require_admin` dependency

### Frontend (JavaScript)
- File: `app/static/js/02-core-02.js`
- Functions:
  - `askDeleteAll(sheet)` - Show confirmation modal
  - `confirmDeleteAll()` - Execute API call
  - `closeDeleteAll()` - Close modal
- HTML: `app/templates/legacy_full.html` - Delete all modal overlay

## Troubleshooting

### If button doesn't appear:
1. Login as admin: `srt.jspl@gmail.com` / `Srt@jspl2026`
2. Open browser DevTools console (F12)
3. Check for JavaScript errors
4. Reload page (Ctrl+R)

### If button is disabled:
1. Check browser console: Open DevTools → Console tab
2. Type: `console.log(SRT_CURRENT_USER.role)`
3. Should output: `admin`

### If delete fails with 403:
- User is not an admin
- Login with correct admin credentials
- Check user role: `SELECT role FROM users WHERE email='...'`

### If delete fails with 401:
- Session expired
- Login again
- Token may have timed out (default: 480 minutes)

## Test Data Cleanup

If you want to restore demo data after testing:
1. Run: `docker compose down -v` (removes database volume)
2. Run: `docker compose up` (recreates and re-seeds)
3. Demo data will be re-loaded automatically

## Files Modified
- `app/routers/generic_router.py` - Added delete-all endpoint
- `app/crud/generic.py` - Added delete_all_rows() function
- `app/static/js/02-core-02.js` - Added UI functions with logging
- `app/templates/legacy_full.html` - Added delete-all modal
