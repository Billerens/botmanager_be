import { ApiProperty } from "@nestjs/swagger";

export class PublicShopBotResponseDto {
  @ApiProperty({
    description: "ID бота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Название бота",
    example: "Мой магазин",
  })
  name: string;

  @ApiProperty({
    description: "Описание бота",
    example: "Интернет-магазин с широким ассортиментом товаров",
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: "Заголовок магазина",
    example: "Добро пожаловать в наш магазин!",
  })
  shopTitle: string;

  @ApiProperty({
    description: "Описание магазина",
    example: "Мы предлагаем качественные товары по доступным ценам",
    required: false,
  })
  shopDescription?: string;

  @ApiProperty({
    description: "URL логотипа магазина",
    example: "https://example.com/shop-logo.png",
    required: false,
  })
  shopLogoUrl?: string;

  @ApiProperty({
    description: "Пользовательские стили магазина",
    example: {
      primaryColor: "#007bff",
      secondaryColor: "#6c757d",
      backgroundColor: "#ffffff",
      textColor: "#333333",
    },
    required: false,
  })
  shopCustomStyles?: Record<string, any>;

  @ApiProperty({
    description: "Типы кнопок в магазине",
    example: ["inline", "url", "callback"],
    required: false,
  })
  shopButtonTypes?: string[];

  @ApiProperty({
    description: "Настройки кнопок магазина",
    example: {
      addToCartText: "Добавить в корзину",
      buyNowText: "Купить сейчас",
      viewDetailsText: "Подробнее",
    },
    required: false,
  })
  shopButtonSettings?: Record<string, any>;

  @ApiProperty({
    description: "URL магазина",
    example: "https://t.me/my_shop_bot",
    required: false,
  })
  shopUrl?: string;

  @ApiProperty({
    description: "Список активных товаров",
    example: [
      {
        id: "product-1",
        name: "Товар 1",
        description: "Описание товара 1",
        price: 1000,
        imageUrl: "https://example.com/product1.jpg",
        isActive: true,
      },
    ],
  })
  products: Array<{
    id: string;
    name: string;
    description?: string;
    price?: number;
    imageUrl?: string;
    isActive: boolean;
  }>;
}

export class PublicBookingBotResponseDto {
  @ApiProperty({
    description: "ID бота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Название бота",
    example: "Бронирование услуг",
  })
  name: string;

  @ApiProperty({
    description: "Описание бота",
    example: "Запись на услуги через Telegram",
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: "Заголовок для бронирования",
    example: "Записаться на услугу",
  })
  bookingTitle: string;

  @ApiProperty({
    description: "Описание для бронирования",
    example: "Выберите удобное время и услугу",
    required: false,
  })
  bookingDescription?: string;

  @ApiProperty({
    description: "URL логотипа для бронирования",
    example: "https://example.com/booking-logo.png",
    required: false,
  })
  bookingLogoUrl?: string;

  @ApiProperty({
    description: "Пользовательские стили для бронирования",
    example: {
      primaryColor: "#28a745",
      secondaryColor: "#6c757d",
      backgroundColor: "#ffffff",
      textColor: "#333333",
    },
    required: false,
  })
  bookingCustomStyles?: Record<string, any>;

  @ApiProperty({
    description: "Список специалистов",
    example: [
      {
        id: "specialist-1",
        name: "Анна Иванова",
        description: "Мастер маникюра",
        avatarUrl: "https://example.com/avatar1.jpg",
        isActive: true,
      },
    ],
  })
  specialists: Array<{
    id: string;
    name: string;
    description?: string;
    avatarUrl?: string;
    isActive: boolean;
  }>;

  @ApiProperty({
    description: "Список услуг",
    example: [
      {
        id: "service-1",
        name: "Маникюр",
        description: "Классический маникюр",
        price: 1500,
        duration: 60,
        isActive: true,
      },
    ],
  })
  services: Array<{
    id: string;
    name: string;
    description?: string;
    price?: number;
    duration: number;
    isActive: boolean;
  }>;
}
