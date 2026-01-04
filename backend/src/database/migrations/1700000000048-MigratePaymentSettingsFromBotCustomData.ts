import { MigrationInterface, QueryRunner } from "typeorm";

export class MigratePaymentSettingsFromBotCustomData1700000000048
  implements MigrationInterface
{
  name = "MigratePaymentSettingsFromBotCustomData1700000000048";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Получаем все существующие настройки платежей из bot_custom_data
    const existingSettings = await queryRunner.query(`
      SELECT 
        bcd.id,
        bcd."botId",
        bcd.data,
        b."ownerId"
      FROM bot_custom_data bcd
      INNER JOIN bots b ON b.id = bcd."botId"
      WHERE bcd.collection = 'payment_settings'
        AND bcd.key = 'config'
    `);

    if (existingSettings.length === 0) {
      console.log("No existing payment settings to migrate");
      return;
    }

    console.log(
      `Migrating ${existingSettings.length} payment settings from bot_custom_data`
    );

    for (const setting of existingSettings) {
      const botId = setting.botId;
      const ownerId = setting.ownerId;
      const data = setting.data;

      if (!data || !data.global) {
        console.log(`Skipping invalid settings for bot ${botId}`);
        continue;
      }

      // Маппинг модулей в новую структуру
      // В старой структуре: modules.shop, modules.booking, modules.api
      // В новой структуре: отдельные записи для каждой сущности

      // Создаём запись для Bot (общие настройки)
      const enabled = data.global.enabled || false;
      const testMode = data.global.testMode !== false;

      // Берём настройки из модуля api как настройки для бота
      const apiModule = data.modules?.api || {};
      const botSettings = {
        currency: apiModule.settings?.currency || "RUB",
        supportedPaymentMethods: apiModule.settings
          ?.supportedPaymentMethods || ["card", "sbp"],
        requireCustomerData: apiModule.settings?.requireCustomerData ?? true,
        allowPartialPayments: apiModule.settings?.allowPartialPayments ?? false,
        sendPaymentConfirmations:
          apiModule.settings?.sendPaymentConfirmations ?? true,
        sendReceipts: apiModule.settings?.sendReceipts ?? true,
        webhookUrl: apiModule.settings?.webhookUrl,
        emailForNotifications: apiModule.settings?.emailForNotifications,
      };

      // Провайдеры и их настройки из модуля api
      const providers = (apiModule.providers || []).join(",");
      const providerSettings = apiModule.providerSettings || {};

      // Вставляем запись для бота
      await queryRunner.query(
        `
        INSERT INTO payment_configs 
          ("entityType", "entityId", "ownerId", "enabled", "testMode", "settings", "providers", "providerSettings")
        VALUES 
          ('bot', $1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ("entityType", "entityId") DO UPDATE SET
          "enabled" = EXCLUDED."enabled",
          "testMode" = EXCLUDED."testMode",
          "settings" = EXCLUDED."settings",
          "providers" = EXCLUDED."providers",
          "providerSettings" = EXCLUDED."providerSettings",
          "updatedAt" = CURRENT_TIMESTAMP
      `,
        [
          botId,
          ownerId,
          enabled,
          testMode,
          JSON.stringify(botSettings),
          providers,
          JSON.stringify(providerSettings),
        ]
      );

      // Если у бота есть привязанный магазин, создаём настройки для него
      const shopResult = await queryRunner.query(
        `
        SELECT id, "ownerId" FROM shops WHERE "botId" = $1
      `,
        [botId]
      );

      if (shopResult.length > 0) {
        const shop = shopResult[0];
        const shopModule = data.modules?.shop || {};
        const shopEnabled = shopModule.settings?.enabled || false;
        const shopSettings = {
          currency: shopModule.settings?.currency || "RUB",
          minAmount: shopModule.settings?.minAmount,
          maxAmount: shopModule.settings?.maxAmount,
          supportedPaymentMethods: shopModule.settings
            ?.supportedPaymentMethods || ["card", "sbp"],
          requireCustomerData: shopModule.settings?.requireCustomerData ?? true,
          allowPartialPayments:
            shopModule.settings?.allowPartialPayments ?? false,
          sendPaymentConfirmations:
            shopModule.settings?.sendPaymentConfirmations ?? true,
          sendReceipts: shopModule.settings?.sendReceipts ?? true,
          webhookUrl: shopModule.settings?.webhookUrl,
          emailForNotifications: shopModule.settings?.emailForNotifications,
        };

        const shopProviders = (shopModule.providers || []).join(",");
        const shopProviderSettings = shopModule.providerSettings || {};

        await queryRunner.query(
          `
          INSERT INTO payment_configs 
            ("entityType", "entityId", "ownerId", "enabled", "testMode", "settings", "providers", "providerSettings")
          VALUES 
            ('shop', $1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT ("entityType", "entityId") DO UPDATE SET
            "enabled" = EXCLUDED."enabled",
            "testMode" = EXCLUDED."testMode",
            "settings" = EXCLUDED."settings",
            "providers" = EXCLUDED."providers",
            "providerSettings" = EXCLUDED."providerSettings",
            "updatedAt" = CURRENT_TIMESTAMP
        `,
          [
            shop.id,
            shop.ownerId,
            shopEnabled && enabled, // Shop enabled только если и глобально enabled
            testMode,
            JSON.stringify(shopSettings),
            shopProviders,
            JSON.stringify(shopProviderSettings),
          ]
        );
      }

      // Если у бота есть привязанная система бронирования, создаём настройки для неё
      const bookingResult = await queryRunner.query(
        `
        SELECT id, "ownerId" FROM booking_systems WHERE "botId" = $1
      `,
        [botId]
      );

      if (bookingResult.length > 0) {
        const bookingSystem = bookingResult[0];
        const bookingModule = data.modules?.booking || {};
        const bookingEnabled = bookingModule.settings?.enabled || false;
        const bookingSettings = {
          currency: bookingModule.settings?.currency || "RUB",
          minAmount: bookingModule.settings?.minAmount,
          maxAmount: bookingModule.settings?.maxAmount,
          supportedPaymentMethods: bookingModule.settings
            ?.supportedPaymentMethods || ["card", "sbp"],
          requireCustomerData:
            bookingModule.settings?.requireCustomerData ?? true,
          allowPartialPayments:
            bookingModule.settings?.allowPartialPayments ?? false,
          sendPaymentConfirmations:
            bookingModule.settings?.sendPaymentConfirmations ?? true,
          sendReceipts: bookingModule.settings?.sendReceipts ?? true,
          webhookUrl: bookingModule.settings?.webhookUrl,
          emailForNotifications: bookingModule.settings?.emailForNotifications,
        };

        const bookingProviders = (bookingModule.providers || []).join(",");
        const bookingProviderSettings = bookingModule.providerSettings || {};

        await queryRunner.query(
          `
          INSERT INTO payment_configs 
            ("entityType", "entityId", "ownerId", "enabled", "testMode", "settings", "providers", "providerSettings")
          VALUES 
            ('booking_system', $1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT ("entityType", "entityId") DO UPDATE SET
            "enabled" = EXCLUDED."enabled",
            "testMode" = EXCLUDED."testMode",
            "settings" = EXCLUDED."settings",
            "providers" = EXCLUDED."providers",
            "providerSettings" = EXCLUDED."providerSettings",
            "updatedAt" = CURRENT_TIMESTAMP
        `,
          [
            bookingSystem.id,
            bookingSystem.ownerId,
            bookingEnabled && enabled,
            testMode,
            JSON.stringify(bookingSettings),
            bookingProviders,
            JSON.stringify(bookingProviderSettings),
          ]
        );
      }

      console.log(`Migrated payment settings for bot ${botId}`);
    }

    console.log("Payment settings migration completed");

    // НЕ удаляем старые записи из bot_custom_data для обратной совместимости
    // Можно удалить в отдельной миграции после проверки работоспособности
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // При откате миграции удаляем все записи из payment_configs,
    // которые были созданы на основе bot_custom_data
    // Старые данные в bot_custom_data остаются нетронутыми

    await queryRunner.query(`
      DELETE FROM payment_configs 
      WHERE "entityType" IN ('bot', 'shop', 'booking_system')
    `);

    console.log("Rolled back payment settings migration");
  }
}
