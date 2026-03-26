#!/usr/bin/env bash
# Usage: ./scripts/test-create-user-and-send-otp.sh [BASE_URL]
# Default BASE_URL: http://localhost:6010

set -e
BASE_URL="${1:-http://localhost:6010}"
PHONE="8899221111"   # Test number that gets default OTP 123456
USERNAME="testuser$(date +%s)"  # Unique username per run

echo "=== 1. Create user (POST /api/users/createUser) ==="
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/users/createUser" \
  -H "Content-Type: application/json" \
  -d "{
    \"fullName\": \"Test User\",
    \"username\": \"${USERNAME}\",
    \"gender\": \"male\",
    \"phone\": \"${PHONE}\",
    \"coordinates\": [28.6139, 77.2090]
  }")
HTTP_BODY=$(echo "$CREATE_RESPONSE" | sed '$d')
HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n 1)
echo "HTTP $HTTP_CODE"
echo "$HTTP_BODY" | head -c 500
echo ""
echo ""

echo "=== 2. Send OTP (POST /api/auth/sendOTP) ==="
OTP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/sendOTP" \
  -H "Content-Type: application/json" \
  -d "{\"mobileNo\": \"${PHONE}\", \"cc\": \"91\"}")
OTP_BODY=$(echo "$OTP_RESPONSE" | sed '$d')
OTP_CODE=$(echo "$OTP_RESPONSE" | tail -n 1)
echo "HTTP $OTP_CODE"
echo "$OTP_BODY"
echo ""
echo "Done. Use mobileNo=${PHONE} and otp=123456 for verifyOTP (test number gets default OTP)."
