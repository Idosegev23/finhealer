#!/bin/bash

# בדיקת Cron Jobs מקומית
# שימוש: ./test-cron.sh

CRON_SECRET="finhealer-cron-secret-2025-change-me-in-production"
BASE_URL="http://localhost:3000"

echo "🧪 Testing FinHealer Cron Jobs..."
echo ""

# בדיקת Webhook
echo "1️⃣ Testing Webhook..."
curl -s "$BASE_URL/api/wa/webhook" | python3 -m json.tool
echo ""
echo ""

# בדיקת Daily Summary
echo "2️⃣ Testing Daily Summary..."
curl -s -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/cron/daily-summary" | python3 -m json.tool
echo ""
echo ""

# בדיקת Weekly Report
echo "3️⃣ Testing Weekly Report..."
curl -s -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/cron/weekly-report" | python3 -m json.tool
echo ""
echo ""

# בדיקת Monthly Budget
echo "4️⃣ Testing Monthly Budget..."
curl -s -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/cron/monthly-budget" | python3 -m json.tool
echo ""
echo ""

# בדיקת Hourly Alerts
echo "5️⃣ Testing Hourly Alerts..."
curl -s -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/cron/hourly-alerts" | python3 -m json.tool
echo ""
echo ""

echo "✅ All tests completed!"

