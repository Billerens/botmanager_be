/**
 * Скрипт для создания первого суперадминистратора
 * Запуск: npx ts-node src/modules/admin/scripts/create-superadmin.ts
 */

import { DataSource } from "typeorm";
import * as crypto from "crypto";
import * as readline from "readline";
import { Admin, AdminRole, AdminStatus } from "../../../database/entities/admin.entity";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
};

const generatePassword = (): string => {
  const length = 16;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  return password;
};

async function main() {
  console.log("\n🔐 Создание суперадминистратора\n");
  console.log("=====================================\n");

  // Получаем данные от пользователя
  const username = await question("Введите username: ");
  const firstName = await question("Введите имя: ");
  const lastName = await question("Введите фамилию: ");
  const telegramId = await question("Введите Telegram ID: ");
  const telegramUsername = await question(
    "Введите Telegram username (опционально): "
  );
  const passwordRecipientTelegramId = await question(
    "Введите Telegram ID получателя паролей (опционально, по умолчанию - ваш): "
  );

  // Генерируем пароль
  const password = generatePassword();

  console.log("\n📝 Данные администратора:");
  console.log(`   Username: ${username}`);
  console.log(`   Имя: ${firstName} ${lastName}`);
  console.log(`   Telegram ID: ${telegramId}`);
  console.log(`   Пароль: ${password}`);
  console.log("");

  const confirm = await question(
    "Создать администратора? (yes/no): "
  );

  if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
    console.log("\n❌ Отменено\n");
    rl.close();
    process.exit(0);
  }

  // Подключаемся к базе данных
  const dataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_DATABASE || "botmanager",
    entities: [Admin],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log("\n✅ Подключение к базе данных успешно\n");

    const adminRepository = dataSource.getRepository(Admin);

    // Проверяем, существует ли уже админ с таким username или telegramId
    const existing = await adminRepository.findOne({
      where: [{ username }, { telegramId }],
    });

    if (existing) {
      console.log("\n❌ Администратор с таким username или Telegram ID уже существует\n");
      await dataSource.destroy();
      rl.close();
      process.exit(1);
    }

    // Создаем админа
    const admin = adminRepository.create({
      username,
      password,
      firstName,
      lastName,
      telegramId,
      telegramUsername: telegramUsername || null,
      role: AdminRole.SUPERADMIN,
      status: AdminStatus.ACTIVE,
      isActive: true,
      passwordRotationDays: 30,
      passwordRecipientTelegramId:
        passwordRecipientTelegramId || telegramId,
    });

    await adminRepository.save(admin);

    console.log("\n✅ Суперадминистратор успешно создан!\n");
    console.log("=====================================");
    console.log(`🔑 Username: ${username}`);
    console.log(`🔐 Пароль: ${password}`);
    console.log("=====================================");
    console.log("\n⚠️  ВАЖНО: Сохраните пароль в надежном месте!");
    console.log("    При первом входе рекомендуется сменить пароль.\n");

    await dataSource.destroy();
  } catch (error) {
    console.error("\n❌ Ошибка:", error.message);
    await dataSource.destroy();
    rl.close();
    process.exit(1);
  }

  rl.close();
}

main();

