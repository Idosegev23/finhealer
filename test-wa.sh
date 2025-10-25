#!/bin/bash

echo "🧪 Testing WhatsApp (GreenAPI)..."
echo ""
echo "📱 Target: 972547667775"
echo "🔗 Endpoint: http://localhost:3000/api/test/wa"
echo ""
echo "Starting test..."
echo ""

# בדוק אם השרת רץ
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Server is not running!"
    echo "Please run: npm run dev"
    exit 1
fi

# שלח בקשה
curl -s "http://localhost:3000/api/test/wa?phone=972547667775" | jq '.'

echo ""
echo "✅ Test completed!"
echo ""
echo "Check your WhatsApp (972547667775) for the message!"
