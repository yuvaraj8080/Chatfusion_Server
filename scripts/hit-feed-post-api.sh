#!/usr/bin/env bash
set -e

BASE_URL="http://localhost:6010"
PHONE="8899221111"
USERNAME="feedtestuser_$(date +%s)"

echo "=== 1. Create/Ensure User Exists ==="
# We try to create a user. If it fails (phone exists), we ignore the failure and proceed to login.
curl -s -X POST "${BASE_URL}/api/users/createUser" \
  -H "Content-Type: application/json" \
  -d "{
    \"fullName\": \"Feed Test User\",
    \"username\": \"${USERNAME}\",
    \"gender\": \"male\",
    \"phone\": \"${PHONE}\",
    \"coordinates\": [28.6139, 77.2090]
  }" > /dev/null || true
echo "User creation attempt done (ignoring 400 if already exists)."

echo "=== 2. Login to get Access Token ==="
LOGIN_RES=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"phoneNumber\": \"${PHONE}\"
  }")

# Extract Access Token using a simple python one-liner (assuming python3 is installed, which is standard on mac)
ACCESS_TOKEN=$(echo "$LOGIN_RES" | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])")

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "None" ]; then
  echo "Failed to get access token. Login response:"
  echo "$LOGIN_RES"
  exit 1
fi

echo "Got Access Token: ${ACCESS_TOKEN:0:20}..."

echo "=== 3. Hit Feed Post API (/api/posts/getUserFeed) ==="
curl -v "${BASE_URL}/api/posts/getUserFeed" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json"
echo ""
