#!/bin/bash

# Test delete-all endpoint
echo "Testing delete-all endpoint..."

# Get admin token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"srt.jspl@gmail.com","password":"Srt@jspl2026"}' | jq -r '.access_token')

echo "Token: ${TOKEN:0:20}..."

# Try delete-all for invoices
echo ""
echo "Deleting all invoices..."
curl -s -X DELETE http://localhost:8000/api/invoices/delete-all/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .

# Check if invoices are empty
echo ""
echo "Checking invoices after delete..."
curl -s http://localhost:8000/api/invoices \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
