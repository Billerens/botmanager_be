# Диагностика "Connection refused" для Telegram Webhook

## Проблема

```
"last_error_message":"Connection refused"
"pending_update_count":3
```

Telegram пытается отправить обновления, но не может подключиться к вашему серверу.

## Причины

### 1. Сервер не слушает на правильном адресе

**Проверка:**

```bash
# В main.ts должно быть:
await app.listen(port, "0.0.0.0");  # НЕ "localhost"!
```

Если указан `localhost` или `127.0.0.1`, сервер доступен только локально.

### 2. Firewall блокирует входящие соединения

**Проверка:**

```bash
# Проверьте, открыт ли порт 3000
sudo netstat -tulpn | grep :3000

# Проверьте правила firewall
sudo ufw status
sudo iptables -L -n
```

**Решение:**

```bash
# Откройте порт 3000
sudo ufw allow 3000/tcp

# Или для iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

### 3. Reverse proxy (nginx/apache) не настроен

Если используете nginx перед вашим API:

**Проверка конфигурации nginx:**

```nginx
server {
    listen 443 ssl;
    server_name api.botmanagertest.online;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api/telegram/webhook {
        proxy_pass http://localhost:3000/api/telegram/webhook;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Перезапустите nginx:**

```bash
sudo nginx -t  # Проверка конфигурации
sudo systemctl restart nginx
```

### 4. SSL сертификат не настроен

Telegram требует HTTPS для webhook.

**Проверка:**

```bash
curl -I https://api.botmanagertest.online
```

**Установка Let's Encrypt:**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.botmanagertest.online
```

### 5. Docker/Container networking

Если используете Docker:

**docker-compose.yml:**

```yaml
services:
  api:
    ports:
      - "3000:3000" # Убедитесь, что порт проброшен
    environment:
      - HOST=0.0.0.0 # НЕ localhost!
```

## Пошаговая диагностика

### Шаг 1: Проверьте локальный доступ

```bash
curl http://localhost:3000/api/telegram/health
```

Ожидаемый ответ:

```json
{ "ok": true, "message": "Telegram webhook endpoint is accessible" }
```

### Шаг 2: Проверьте доступ извне

```bash
curl https://api.botmanagertest.online/api/telegram/health
```

Если не работает - проблема в nginx/firewall/DNS.

### Шаг 3: Проверьте с сервера Telegram

```bash
# Отправьте тестовый запрос
curl -X POST https://api.telegram.org/bot<YOUR_TOKEN>/sendMessage \
  -H "Content-Type: application/json" \
  -d '{"chat_id": YOUR_CHAT_ID, "text": "Test"}'
```

### Шаг 4: Проверьте логи

**Логи приложения:**

```bash
# Должны появиться при запросе к webhook
🎯 Получен webhook от Telegram!
```

**Логи nginx:**

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

**Системные логи:**

```bash
sudo journalctl -u nginx -f
```

### Шаг 5: Временное решение - удалите webhook

```bash
curl -X POST http://localhost:3000/api/telegram/delete-webhook
```

Это позволит вам использовать polling для тестирования.

## Быстрое решение для локальной разработки

### Вариант 1: ngrok

```bash
npm install -g ngrok
ngrok http 3000

# Обновите webhook URL
export WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
npm run start:dev
```

### Вариант 2: localtunnel

```bash
npm install -g localtunnel
lt --port 3000 --subdomain mybotmanager
```

## Проверка всего флоу

1. **Запустите приложение:**

   ```bash
   npm run start:dev
   ```

2. **Проверьте health endpoint локально:**

   ```bash
   curl http://localhost:3000/api/telegram/health
   ```

3. **Проверьте health endpoint публично:**

   ```bash
   curl https://api.botmanagertest.online/api/telegram/health
   ```

4. **Проверьте webhook info:**

   ```bash
   curl -X POST http://localhost:3000/api/telegram/get-webhook-info
   ```

5. **Если есть ошибки, переустановите webhook:**

   ```bash
   curl -X POST http://localhost:3000/api/telegram/set-webhook
   ```

6. **Отправьте /start боту в Telegram**

7. **Проверьте логи приложения** - должны появиться сообщения о получении webhook

## Чеклист для production

- [ ] Приложение слушает на `0.0.0.0:3000`
- [ ] Порт 3000 открыт в firewall
- [ ] nginx настроен и работает
- [ ] SSL сертификат установлен и валиден
- [ ] DNS настроен правильно
- [ ] `WEBHOOK_BASE_URL=https://api.botmanagertest.online`
- [ ] Health endpoint доступен: `https://api.botmanagertest.online/api/telegram/health`
- [ ] Webhook установлен без ошибок
- [ ] В webhook info нет `last_error_message`

## Если ничего не помогает

Используйте Long Polling вместо Webhook (для разработки):

```typescript
// telegram.service.ts
async startPolling() {
  let offset = 0;

  while (true) {
    try {
      const updates = await axios.get(
        `${this.getBotApiUrl()}/getUpdates?offset=${offset}`
      );

      for (const update of updates.data.result) {
        await this.handleWebhook(update);
        offset = update.update_id + 1;
      }
    } catch (error) {
      console.error('Polling error:', error);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```
