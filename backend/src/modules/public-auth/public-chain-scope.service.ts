import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Shop } from "../../database/entities/shop.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { CustomPage } from "../../database/entities/custom-page.entity";
import { Bot } from "../../database/entities/bot.entity";
import { PublicUserOwnerType } from "../../database/entities/public-user.entity";

type NodeKey = string; // "shop:id" | "booking:id" | "page:id" | "bot:id"

export interface ScopeResult {
  scopeId: string;
  scopeType: PublicUserOwnerType;
}

/**
 * Вычисляет scope (цепочку или одну сущность) по связям между сущностями владельца.
 * Цепочка = связная компонента графа: Shop–Bot, Booking–Bot, CustomPage–Shop/Booking/Bot.
 */
@Injectable()
export class PublicChainScopeService {
  constructor(
    @InjectRepository(Shop)
    private shopRepository: Repository<Shop>,
    @InjectRepository(BookingSystem)
    private bookingRepository: Repository<BookingSystem>,
    @InjectRepository(CustomPage)
    private customPageRepository: Repository<CustomPage>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
  ) {}

  private nodeKey(type: string, id: string): NodeKey {
    return `${type}:${id}`;
  }

  /**
   * Scope для сущности: если она в связной цепочке с другими — (minId, CHAIN), иначе (entityId, ownerType).
   */
  async getScopeForEntity(
    ownerType: PublicUserOwnerType,
    entityId: string,
  ): Promise<ScopeResult> {
    const ownerId = await this.getOwnerId(ownerType, entityId);
    const componentIds = await this.getConnectedComponentIds(
      ownerId,
      ownerType,
      entityId,
    );
    if (componentIds.length <= 1) {
      return { scopeId: entityId, scopeType: ownerType };
    }
    const chainKey = componentIds.sort()[0];
    return { scopeId: chainKey, scopeType: PublicUserOwnerType.CHAIN };
  }

  /**
   * Scope для магазина (без повторной загрузки shop, если уже есть ownerId и botId).
   */
  async getScopeForShop(shop: {
    id: string;
    ownerId: string;
    botId?: string | null;
  }): Promise<ScopeResult> {
    const componentIds = await this.getConnectedComponentIds(
      shop.ownerId,
      PublicUserOwnerType.SHOP,
      shop.id,
    );
    if (componentIds.length <= 1) {
      return { scopeId: shop.id, scopeType: PublicUserOwnerType.SHOP };
    }
    const chainKey = componentIds.sort()[0];
    return { scopeId: chainKey, scopeType: PublicUserOwnerType.CHAIN };
  }

  private async getOwnerId(
    ownerType: PublicUserOwnerType,
    entityId: string,
  ): Promise<string> {
    if (ownerType === PublicUserOwnerType.USER) {
      return entityId;
    }
    const shop =
      ownerType === PublicUserOwnerType.SHOP
        ? await this.shopRepository.findOne({
            where: { id: entityId },
            select: ["ownerId"],
          })
        : null;
    if (shop) return shop.ownerId;
    const booking =
      ownerType === PublicUserOwnerType.BOOKING
        ? await this.bookingRepository.findOne({
            where: { id: entityId },
            select: ["ownerId"],
          })
        : null;
    if (booking) return booking.ownerId;
    const page =
      ownerType === PublicUserOwnerType.CUSTOM_PAGE
        ? await this.customPageRepository.findOne({
            where: { id: entityId },
            select: ["ownerId"],
          })
        : null;
    if (page) return page.ownerId;
    const bot =
      ownerType === PublicUserOwnerType.BOT
        ? await this.botRepository.findOne({
            where: { id: entityId },
            select: ["ownerId"],
          })
        : null;
    if (bot) return bot.ownerId;
    throw new BadRequestException("Сущность не найдена");
  }

  private async getConnectedComponentIds(
    ownerId: string,
    startType: PublicUserOwnerType,
    startId: string,
  ): Promise<string[]> {
    const [shops, bookings, pages, bots] = await Promise.all([
      this.shopRepository.find({
        where: { ownerId },
        select: ["id", "botId"],
      }),
      this.bookingRepository.find({
        where: { ownerId },
        select: ["id", "botId"],
      }),
      this.customPageRepository.find({
        where: { ownerId },
        select: ["id", "shopId", "bookingSystemId", "botId"],
      }),
      this.botRepository.find({
        where: { ownerId },
        select: ["id"],
      }),
    ]);

    const adj = new Map<NodeKey, Set<NodeKey>>();
    const addEdge = (a: NodeKey, b: NodeKey) => {
      if (!adj.has(a)) adj.set(a, new Set());
      adj.get(a)!.add(b);
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(b)!.add(a);
    };

    for (const s of shops) {
      const sk = this.nodeKey("shop", s.id);
      if (s.botId) addEdge(sk, this.nodeKey("bot", s.botId));
    }
    for (const b of bookings) {
      const bk = this.nodeKey("booking", b.id);
      if (b.botId) addEdge(bk, this.nodeKey("bot", b.botId));
    }
    for (const p of pages) {
      const pk = this.nodeKey("page", p.id);
      if (p.shopId) addEdge(pk, this.nodeKey("shop", p.shopId));
      if (p.bookingSystemId)
        addEdge(pk, this.nodeKey("booking", p.bookingSystemId));
      if (p.botId) addEdge(pk, this.nodeKey("bot", p.botId));
    }

    const startKey = this.nodeKey(
      startType === PublicUserOwnerType.SHOP
        ? "shop"
        : startType === PublicUserOwnerType.BOOKING
          ? "booking"
          : startType === PublicUserOwnerType.CUSTOM_PAGE
            ? "page"
            : "bot",
      startId,
    );
    const visited = new Set<NodeKey>();
    const queue: NodeKey[] = [startKey];
    visited.add(startKey);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of adj.get(cur) ?? []) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }

    const ids: string[] = [];
    for (const k of visited) {
      ids.push(k.split(":")[1]);
    }
    return ids;
  }
}
