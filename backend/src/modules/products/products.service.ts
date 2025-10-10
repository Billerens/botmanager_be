import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, Between } from "typeorm";
import { Product } from "../../database/entities/product.entity";
import { Bot } from "../../database/entities/bot.entity";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductFiltersDto,
} from "./dto/product.dto";

export interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  outOfStockProducts: number;
  totalValue: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>
  ) {}

  async create(
    botId: string,
    userId: string,
    createProductDto: CreateProductDto
  ): Promise<Product> {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const product = this.productRepository.create({
      ...createProductDto,
      botId,
    });

    return await this.productRepository.save(product);
  }

  async findAll(botId: string, userId: string, filters: ProductFiltersDto) {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Устанавливаем значения по умолчанию если они не переданы
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const { search, isActive, inStock } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productRepository
      .createQueryBuilder("product")
      .where("product.botId = :botId", { botId })
      .skip(skip)
      .take(limit)
      .orderBy("product.createdAt", "DESC");

    if (search) {
      queryBuilder.andWhere("product.name ILIKE :search", {
        search: `%${search}%`,
      });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere("product.isActive = :isActive", { isActive });
    }

    if (inStock !== undefined) {
      if (inStock) {
        queryBuilder.andWhere("product.stockQuantity > 0");
      } else {
        queryBuilder.andWhere("product.stockQuantity = 0");
      }
    }

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, botId: string, userId: string): Promise<Product> {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const product = await this.productRepository.findOne({
      where: { id, botId },
    });

    if (!product) {
      throw new NotFoundException("Товар не найден");
    }

    return product;
  }

  async update(
    id: string,
    botId: string,
    userId: string,
    updateProductDto: UpdateProductDto
  ): Promise<Product> {
    const product = await this.findOne(id, botId, userId);

    Object.assign(product, updateProductDto);
    return await this.productRepository.save(product);
  }

  async remove(id: string, botId: string, userId: string): Promise<void> {
    const product = await this.findOne(id, botId, userId);
    await this.productRepository.remove(product);
  }

  async getBotProductStats(
    botId: string,
    userId: string
  ): Promise<ProductStats> {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const [
      totalProducts,
      activeProducts,
      inactiveProducts,
      outOfStockProducts,
      totalValueResult,
    ] = await Promise.all([
      this.productRepository.count({ where: { botId } }),
      this.productRepository.count({ where: { botId, isActive: true } }),
      this.productRepository.count({ where: { botId, isActive: false } }),
      this.productRepository.count({ where: { botId, stockQuantity: 0 } }),
      this.productRepository
        .createQueryBuilder("product")
        .select("SUM(product.price * product.stockQuantity)", "totalValue")
        .where("product.botId = :botId", { botId })
        .getRawOne(),
    ]);

    return {
      totalProducts,
      activeProducts,
      inactiveProducts,
      outOfStockProducts,
      totalValue: parseFloat(totalValueResult?.totalValue || "0"),
    };
  }

  async updateStock(
    id: string,
    botId: string,
    userId: string,
    quantity: number
  ): Promise<Product> {
    const product = await this.findOne(id, botId, userId);

    product.stockQuantity = quantity;
    return await this.productRepository.save(product);
  }

  async toggleActive(
    id: string,
    botId: string,
    userId: string
  ): Promise<Product> {
    const product = await this.findOne(id, botId, userId);

    product.isActive = !product.isActive;
    return await this.productRepository.save(product);
  }
}
