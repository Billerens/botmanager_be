#!/bin/bash

echo "🔍 Проверка доступности webhook..."
echo ""

# 1. Проверка локального сервера
echo "1️⃣ Проверка локального сервера:"
curl -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"update_id":1,"message":{"message_id":1,"from":{"id":123456789,"is_bot":false,"first_name":"Test"},"chat":{"id":123456789,"first_name":"Test","type":"private"},"date":1234567890,"text":"/start"}}' \
  -w "\nHTTP Status: %{http_code}\n" \
  2>&1

echo ""
echo "2️⃣ Проверка публичного URL:"
curl -X POST https://api.botmanagertest.online/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"update_id":1,"message":{"message_id":1,"from":{"id":123456789,"is_bot":false,"first_name":"Test"},"chat":{"id":123456789,"first_name":"Test","type":"private"},"date":1234567890,"text":"/start"}}' \
  -w "\nHTTP Status: %{http_code}\n" \
  2>&1

echo ""
echo "3️⃣ Проверка SSL сертификата:"
curl -I https://api.botmanagertest.online 2>&1

echo ""
echo "4️⃣ Информация о webhook из Telegram:"
curl -X POST http://localhost:3000/api/telegram/get-webhook-info \
  -H "Content-Type: application/json" 2>&1 | python3 -m json.tool || cat

echo ""
echo "✅ Проверка завершена"

