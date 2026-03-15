import { Injectable, Logger, ForbiddenException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Socket } from "socket.io";
import * as crypto from "crypto";

import { Bot } from "../../database/entities/bot.entity";
import { BotFlow, FlowStatus } from "../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../database/entities/bot-flow-node.entity";
import { BotCustomData } from "../../database/entities/bot-custom-data.entity";
import { CustomData } from "../../database/entities/custom-data.entity";
import { CustomDataOwnerType } from "../../database/entities/custom-collection-schema.entity";
import { Shop } from "../../database/entities/shop.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import {
  CustomPage,
  CustomPageStatus,
} from "../../database/entities/custom-page.entity";
import { SimulationSessionStore, SimulationSessionData } from "./simulation-session.store";
import { SimulationTransportService } from "./simulation-transport.service";
import { FlowContext } from "../bots/nodes/base-node-handler.interface";
import { NodeHandlerService } from "../bots/nodes/node-handler.service";
import { UserSession } from "../bots/flow-execution.service";
import { CustomLoggerService } from "../../common/logger.service";

export interface SimulationBotCommandConfig {
  command: string;
  description: string;
  source: "core" | "shop" | "booking" | "custom_page";
}

export interface SimulationMiniAppConfig {
  hasMenuButton: boolean;
  menuButton: {
    enabled: boolean;
    source: "shop" | "booking" | null;
    text: string | null;
    url: string | null;
  };
  shop: {
    commandEnabled: boolean;
    menuButtonEnabled: boolean;
    url: string | null;
  };
  booking: {
    commandEnabled: boolean;
    menuButtonEnabled: boolean;
    url: string | null;
  };
}

export interface SimulationBotConfig {
  botId: string;
  availableCommands: SimulationBotCommandConfig[];
  miniapp: SimulationMiniAppConfig;
}

/** РўРёРїС‹ СѓР·Р»РѕРІ, РєРѕС‚РѕСЂС‹Рµ РЅРµ СЃРёРјСѓР»РёСЂСѓСЋС‚СЃСЏ */
const NON_SIMULATABLE_NODES = new Set([
  "payment",
  "webhook",
  "ai_single",
  "ai_chat",
  "broadcast",
]);

/** Р—Р°РіР»СѓС€РєРё РґР»СЏ РЅРµСЃРёРјСѓР»РёСЂСѓРµРјС‹С… СѓР·Р»РѕРІ */
const NODE_STUBS: Record<string, string> = {
  payment: "рџ’і РЎРёРјСѓР»СЏС†РёСЏ: РѕРїР»Р°С‚Р° РїСЂРѕРїСѓС‰РµРЅР°, РїРµСЂРµС…РѕРґ РґР°Р»РµРµ",
  webhook: "рџ”— РЎРёРјСѓР»СЏС†РёСЏ: РІРµР±С…СѓРє РїСЂРѕРїСѓС‰РµРЅ",
  ai_single: "рџ¤– РЎРёРјСѓР»СЏС†РёСЏ: AI-РѕС‚РІРµС‚ (Р·Р°РіР»СѓС€РєР°)",
  ai_chat: "рџ¤– РЎРёРјСѓР»СЏС†РёСЏ: AI-С‡Р°С‚ (Р·Р°РіР»СѓС€РєР°)",
  broadcast: "рџ“ў РЎРёРјСѓР»СЏС†РёСЏ: СЂР°СЃСЃС‹Р»РєР° РїСЂРѕРїСѓС‰РµРЅР°",
};

@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(BotFlow)
    private readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    private readonly botFlowNodeRepository: Repository<BotFlowNode>,
    @InjectRepository(BotCustomData)
    private readonly customDataRepository: Repository<BotCustomData>,
    @InjectRepository(CustomData)
    private readonly customDataV2Repository: Repository<CustomData>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(BookingSystem)
    private readonly bookingSystemRepository: Repository<BookingSystem>,
    @InjectRepository(CustomPage)
    private readonly customPageRepository: Repository<CustomPage>,
    private readonly sessionStore: SimulationSessionStore,
    private readonly transportService: SimulationTransportService,
    private readonly nodeHandlerService: NodeHandlerService,
    private readonly customLogger: CustomLoggerService,
  ) {}

  /**
   * РџРѕР»СѓС‡РёС‚СЊ runtime-РєРѕРЅС„РёРіСѓСЂР°С†РёСЋ Р±РѕС‚Р° РґР»СЏ РєР»РёРµРЅС‚Р° СЃРёРјСѓР»СЏС†РёРё.
   * Р’РєР»СЋС‡Р°РµС‚ РґРѕСЃС‚СѓРїРЅС‹Рµ РєРѕРјР°РЅРґС‹ Рё РєРѕРЅС„РёРіСѓСЂР°С†РёСЋ miniapp-РєРЅРѕРїРѕРє.
   */
  async getBotConfig(botId: string, ownerId: string): Promise<SimulationBotConfig> {
    const isGuest = ownerId.startsWith("guest:");
    const bot = await this.botRepository.findOne({
      where: isGuest ? { id: botId } : { id: botId, ownerId },
    });

    if (!bot) {
      throw new ForbiddenException("Р‘РѕС‚ РЅРµ РЅР°Р№РґРµРЅ РёР»Рё РЅРµС‚ РґРѕСЃС‚СѓРїР°");
    }

    const [shop, bookingSystem, customPages] = await Promise.all([
      this.shopRepository.findOne({ where: { botId } }),
      this.bookingSystemRepository.findOne({ where: { botId } }),
      this.customPageRepository.find({
        where: {
          botId,
          status: CustomPageStatus.ACTIVE,
        },
      }),
    ]);

    const commands: SimulationBotCommandConfig[] = [
      {
        command: "start",
        description: "Р—Р°РїСѓСЃС‚РёС‚СЊ Р±РѕС‚Р°",
        source: "core",
      },
    ];

    if (shop?.buttonTypes?.includes("command")) {
      commands.push({
        command: "shop",
        description:
          shop.buttonSettings?.command?.description || "рџ›’ РћС‚РєСЂС‹С‚СЊ РјР°РіР°Р·РёРЅ",
        source: "shop",
      });
    }

    if (bookingSystem?.buttonTypes?.includes("command")) {
      commands.push({
        command: "booking",
        description:
          bookingSystem.buttonSettings?.command?.description ||
          "рџ“… Р—Р°РїРёСЃР°С‚СЊСЃСЏ РЅР° РїСЂРёРµРј",
        source: "booking",
      });
    }

    for (const page of customPages) {
      if (!page.botCommand || !page.showInMenu) {
        continue;
      }

      const normalizedCommand = page.botCommand.startsWith("/")
        ? page.botCommand.substring(1)
        : page.botCommand;

      commands.push({
        command: normalizedCommand,
        description: `рџ“„ ${page.title}`,
        source: "custom_page",
      });
    }

    // Р—Р°С‰РёС‚Р° РѕС‚ РґСѓР±Р»РµР№ РєРѕРјР°РЅРґ (РѕСЃС‚Р°РІР»СЏРµРј РїРµСЂРІРѕРµ СЃРѕРІРїР°РґРµРЅРёРµ)
    const uniqueCommands = commands.filter(
      (item, index, arr) =>
        arr.findIndex((candidate) => candidate.command === item.command) === index,
    );

    const shopMenuEnabled = !!shop?.buttonTypes?.includes("menu_button");
    const bookingMenuEnabled = !!bookingSystem?.buttonTypes?.includes("menu_button");

    const shopUrl = shop
      ? shop.url ||
        `${process.env.EXTERNAL_FRONTEND_URL || "https://uforge.online"}/shop/${shop.id}`
      : null;
    const bookingUrl = bookingSystem
      ? bookingSystem.url ||
        `${process.env.EXTERNAL_FRONTEND_URL || "https://uforge.online"}/booking/${bookingSystem.id}`
      : null;

    let menuButton: SimulationMiniAppConfig["menuButton"] = {
      enabled: false,
      source: null,
      text: null,
      url: null,
    };

    // РџСЂРёРѕСЂРёС‚РµС‚ РїРѕР»РЅРѕСЃС‚СЊСЋ РїРѕРІС‚РѕСЂСЏРµС‚ TelegramService.setBotCommands: shop > booking
    if (shopMenuEnabled) {
      menuButton = {
        enabled: true,
        source: "shop",
        text: shop?.buttonSettings?.menu_button?.text || "рџ›’ РњР°РіР°Р·РёРЅ",
        url: shopUrl,
      };
    } else if (bookingMenuEnabled) {
      menuButton = {
        enabled: true,
        source: "booking",
        text: bookingSystem?.buttonSettings?.menu_button?.text || "рџ“… Р—Р°РїРёСЃР°С‚СЊСЃСЏ",
        url: bookingUrl,
      };
    }

    return {
      botId,
      availableCommands: uniqueCommands,
      miniapp: {
        hasMenuButton: menuButton.enabled,
        menuButton,
        shop: {
          commandEnabled: !!shop?.buttonTypes?.includes("command"),
          menuButtonEnabled: shopMenuEnabled,
          url: shopUrl,
        },
        booking: {
          commandEnabled: !!bookingSystem?.buttonTypes?.includes("command"),
          menuButtonEnabled: bookingMenuEnabled,
          url: bookingUrl,
        },
      },
    };
  }

  /**
   * Р—Р°РїСѓСЃС‚РёС‚СЊ РЅРѕРІСѓСЋ СЃРёРјСѓР»СЏС†РёСЋ
   */
  async startSimulation(
    socket: Socket,
    ownerId: string,
    botId: string,
    flowId?: string,
  ): Promise<{ simulationId: string }> {
    // РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ Р±РѕС‚ РїСЂРёРЅР°РґР»РµР¶РёС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ (РґР»СЏ РіРѕСЃС‚РµР№ РїСЂРѕРїСѓСЃРєР°РµРј РїСЂРѕРІРµСЂРєСѓ РІР»Р°РґРµРЅРёСЏ, 
    // С‚Р°Рє РєР°Рє РѕРЅР° СѓР¶Рµ РїСЂРѕРІРµСЂРµРЅР° РІ gateway С‡РµСЂРµР· guestBotId)
    const isGuest = ownerId.startsWith("guest:");
    const bot = await this.botRepository.findOne({
      where: isGuest ? { id: botId } : { id: botId, ownerId },
    });

    if (!bot) {
      throw new ForbiddenException("Р‘РѕС‚ РЅРµ РЅР°Р№РґРµРЅ РёР»Рё РЅРµС‚ РґРѕСЃС‚СѓРїР°");
    }

    // РќР°С…РѕРґРёРј flow
    let activeFlow: BotFlow;
    if (flowId) {
      activeFlow = await this.botFlowRepository.findOne({
        where: { id: flowId, botId },
        relations: ["nodes"],
      });
    } else {
      // Р‘РµСЂС‘Рј Р°РєС‚РёРІРЅС‹Р№ flow
      activeFlow = await this.botFlowRepository.findOne({
        where: { botId, status: FlowStatus.ACTIVE },
        relations: ["nodes"],
      });
    }

    if (!activeFlow) {
      throw new NotFoundException("Flow РЅРµ РЅР°Р№РґРµРЅ РґР»СЏ РґР°РЅРЅРѕРіРѕ Р±РѕС‚Р°");
    }

    // РљРѕРїРёСЂСѓРµРј customData legacy (custom_storage) РІ in-memory snapshot
    const customStorageSnapshot = new Map<string, any>();
    // РљРѕРїРёСЂСѓРµРј customData v2 (custom_data) РІ РѕС‚РґРµР»СЊРЅС‹Р№ snapshot
    const customDataSnapshot = new Map<string, any>();
    try {
      const customRecords = await this.customDataRepository.find({
        where: { botId },
      });
      for (const record of customRecords) {
        const key = `${record.collection}::${record.key}`;
        customStorageSnapshot.set(key, {
          ...record,
          data: JSON.parse(JSON.stringify(record.data)),
        });
      }
      this.logger.log(`РЎРєРѕРїРёСЂРѕРІР°РЅРѕ ${customRecords.length} Р·Р°РїРёСЃРµР№ custom_storage РґР»СЏ СЃРёРјСѓР»СЏС†РёРё`);
    } catch (error) {
      this.logger.warn(`РћС€РёР±РєР° РєРѕРїРёСЂРѕРІР°РЅРёСЏ custom_storage: ${error.message}`);
    }

    try {
      const customDataRecords = await this.customDataV2Repository.find({
        where: {
          ownerId: botId,
          ownerType: CustomDataOwnerType.BOT,
          isDeleted: false,
        },
      });

      for (const record of customDataRecords) {
        const key = `${record.collection}::${record.key}`;
        customDataSnapshot.set(key, {
          ...record,
          data: JSON.parse(JSON.stringify(record.data)),
          indexedData: record.indexedData
            ? JSON.parse(JSON.stringify(record.indexedData))
            : undefined,
          metadata: record.metadata
            ? JSON.parse(JSON.stringify(record.metadata))
            : undefined,
        });
      }
      this.logger.log(`РЎРєРѕРїРёСЂРѕРІР°РЅРѕ ${customDataRecords.length} Р·Р°РїРёСЃРµР№ custom_data РґР»СЏ СЃРёРјСѓР»СЏС†РёРё`);
    } catch (error) {
      this.logger.warn(`РћС€РёР±РєР° РєРѕРїРёСЂРѕРІР°РЅРёСЏ custom_data: ${error.message}`);
    }

    // РЎРѕР·РґР°С‘Рј СЃРµСЃСЃРёСЋ СЃРёРјСѓР»СЏС†РёРё
    const simulationId = crypto.randomUUID();
    const session = this.sessionStore.create({
      simulationId,
      botId,
      flowId: activeFlow.id,
      ownerId,
      socketId: socket.id,
      variables: {},
      customStorageSnapshot,
      customDataSnapshot,
    });

    this.logger.log(`РЎРёРјСѓР»СЏС†РёСЏ Р·Р°РїСѓС‰РµРЅР°: ${simulationId} (bot: ${botId}, flow: ${activeFlow.id})`);

    return { simulationId };
  }

  /**
   * РћР±СЂР°Р±РѕС‚Р°С‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ В«РѕС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏВ» РІ СЃРёРјСѓР»СЏС†РёРё
   */
  async processMessage(
    socket: Socket,
    simulationId: string,
    text: string,
  ): Promise<void> {
    const session = this.sessionStore.get(simulationId);
    if (!session) {
      socket.emit("simulation:error", { message: "РЎРµСЃСЃРёСЏ СЃРёРјСѓР»СЏС†РёРё РЅРµ РЅР°Р№РґРµРЅР°" });
      return;
    }

    this.sessionStore.touch(simulationId);

    // РџРѕР»СѓС‡Р°РµРј Р±РѕС‚Р° Рё flow
    const bot = await this.botRepository.findOne({ where: { id: session.botId } });
    if (!bot) {
      socket.emit("simulation:error", { message: "Р‘РѕС‚ РЅРµ РЅР°Р№РґРµРЅ" });
      return;
    }

    const flow = await this.botFlowRepository.findOne({
      where: { id: session.flowId },
      relations: ["nodes"],
    });
    if (!flow) {
      socket.emit("simulation:error", { message: "Flow РЅРµ РЅР°Р№РґРµРЅ" });
      return;
    }

    // РЎРѕР·РґР°С‘Рј СЃРёРЅС‚РµС‚РёС‡РµСЃРєРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ Telegram
    const syntheticMessage = this.createSyntheticMessage(text, session);

    // РЎРѕР·РґР°С‘Рј РёР·РѕР»РёСЂРѕРІР°РЅРЅСѓСЋ СЃРµСЃСЃРёСЋ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
    const userSession: UserSession = {
      userId: `sim_${simulationId}`,
      chatId: `sim_chat_${simulationId}`,
      botId: session.botId,
      currentNodeId: session.currentNodeId,
      variables: session.variables,
      lastActivity: new Date(),
    };

    // РќР°СЃС‚СЂР°РёРІР°РµРј transport РґР»СЏ WebSocket
    this.transportService.setSocket(socket);

    // РЎРѕР·РґР°С‘Рј FlowContext СЃ РїРѕРґРјРµРЅС‘РЅРЅС‹Рј transport
    const context: FlowContext = {
      bot,
      user: syntheticMessage.from,
      message: syntheticMessage,
      session: userSession,
      flow,
      reachedThroughTransition: false,
      transport: this.transportService,
      executeNodeCallback: async (ctx: FlowContext) => {
        await this.executeNodeWithSimulation(ctx, session, socket);
      },
    };

    try {
      await this.executeSimulationFlow(context, session, socket);
    } catch (error) {
      this.logger.error(`РћС€РёР±РєР° СЃРёРјСѓР»СЏС†РёРё ${simulationId}: ${error.message}`);
      socket.emit("simulation:error", { message: `РћС€РёР±РєР° РІС‹РїРѕР»РЅРµРЅРёСЏ: ${error.message}` });
    } finally {
      this.transportService.clearSocket();
    }
  }

  /**
   * РћР±СЂР°Р±РѕС‚Р°С‚СЊ callback query (РЅР°Р¶Р°С‚РёРµ inline-РєРЅРѕРїРєРё)
   */
  async processCallback(
    socket: Socket,
    simulationId: string,
    callbackData: string,
  ): Promise<void> {
    const session = this.sessionStore.get(simulationId);
    if (!session) {
      socket.emit("simulation:error", { message: "РЎРµСЃСЃРёСЏ СЃРёРјСѓР»СЏС†РёРё РЅРµ РЅР°Р№РґРµРЅР°" });
      return;
    }

    this.sessionStore.touch(simulationId);

    const bot = await this.botRepository.findOne({ where: { id: session.botId } });
    const flow = await this.botFlowRepository.findOne({
      where: { id: session.flowId },
      relations: ["nodes"],
    });

    if (!bot || !flow) {
      socket.emit("simulation:error", { message: "Р‘РѕС‚ РёР»Рё flow РЅРµ РЅР°Р№РґРµРЅ" });
      return;
    }

    // РЎРѕР·РґР°С‘Рј СЃРёРЅС‚РµС‚РёС‡РµСЃРєРёР№ callback_query
    const syntheticMessage = this.createSyntheticCallbackMessage(
      callbackData,
      simulationId,
      session,
    );

    const userSession: UserSession = {
      userId: `sim_${simulationId}`,
      chatId: `sim_chat_${simulationId}`,
      botId: session.botId,
      currentNodeId: session.currentNodeId,
      variables: session.variables,
      lastActivity: new Date(),
    };

    this.transportService.setSocket(socket);

    const context: FlowContext = {
      bot,
      user: syntheticMessage.from,
      message: syntheticMessage,
      session: userSession,
      flow,
      reachedThroughTransition: false,
      transport: this.transportService,
      executeNodeCallback: async (ctx: FlowContext) => {
        await this.executeNodeWithSimulation(ctx, session, socket);
      },
    };

    try {
      await this.executeSimulationFlow(context, session, socket);
    } catch (error) {
      this.logger.error(`РћС€РёР±РєР° callback СЃРёРјСѓР»СЏС†РёРё ${simulationId}: ${error.message}`);
      socket.emit("simulation:error", { message: `РћС€РёР±РєР°: ${error.message}` });
    } finally {
      this.transportService.clearSocket();
    }
  }

  /**
   * РћС‚РїСЂР°РІРёС‚СЊ РґР°РЅРЅС‹Рµ РґР»СЏ endpoint-СѓР·Р»Р°
   */
  async processEndpointData(
    socket: Socket,
    simulationId: string,
    nodeId: string,
    data: Record<string, any>,
  ): Promise<void> {
    const session = this.sessionStore.get(simulationId);
    if (!session) {
      socket.emit("simulation:error", { message: "РЎРµСЃСЃРёСЏ РЅРµ РЅР°Р№РґРµРЅР°" });
      return;
    }

    this.sessionStore.touch(simulationId);

    // Р—Р°РїРёСЃС‹РІР°РµРј РґР°РЅРЅС‹Рµ РІ РїРµСЂРµРјРµРЅРЅС‹Рµ СЃРµСЃСЃРёРё
    Object.assign(session.variables, data);

    // Р•СЃР»Рё flow РѕР¶РёРґР°РµС‚ РЅР° СЌС‚РѕРј endpoint-СѓР·Р»Рµ вЂ” РїСЂРѕРґРѕР»Р¶Р°РµРј РІС‹РїРѕР»РЅРµРЅРёРµ
    if (session.currentNodeId === nodeId) {
      const bot = await this.botRepository.findOne({ where: { id: session.botId } });
      const flow = await this.botFlowRepository.findOne({
        where: { id: session.flowId },
        relations: ["nodes"],
      });

      if (bot && flow) {
        const syntheticMessage = this.createSyntheticMessage("", session);
        const userSession: UserSession = {
          userId: `sim_${simulationId}`,
          chatId: `sim_chat_${simulationId}`,
          botId: session.botId,
          currentNodeId: session.currentNodeId,
          variables: session.variables,
          lastActivity: new Date(),
        };

        this.transportService.setSocket(socket);

        const context: FlowContext = {
          bot,
          user: syntheticMessage.from,
          message: syntheticMessage,
          session: userSession,
          flow,
          reachedThroughTransition: true,
          transport: this.transportService,
          executeNodeCallback: async (ctx: FlowContext) => {
            await this.executeNodeWithSimulation(ctx, session, socket);
          },
        };

        try {
          // РќР°С…РѕРґРёРј endpoint-СѓР·РµР» Рё РїРµСЂРµС…РѕРґРёРј Рє СЃР»РµРґСѓСЋС‰РµРјСѓ
          const endpointNode = flow.nodes.find(n => n.nodeId === nodeId);
          if (endpointNode) {
            context.currentNode = endpointNode;
            await this.executeNodeWithSimulation(context, session, socket);
          }
        } finally {
          this.transportService.clearSocket();
        }
      }
    }
  }

  /**
   * РћСЃС‚Р°РЅРѕРІРёС‚СЊ СЃРёРјСѓР»СЏС†РёСЋ
   */
  stopSimulation(simulationId: string): void {
    this.sessionStore.delete(simulationId);
    this.logger.log(`РЎРёРјСѓР»СЏС†РёСЏ РѕСЃС‚Р°РЅРѕРІР»РµРЅР°: ${simulationId}`);
  }

  /**
   * РћР±СЂР°Р±РѕС‚РєР° disconnect вЂ” РѕС‡РёСЃС‚РєР° СЃРµСЃСЃРёР№ РїРѕ socketId
   */
  handleDisconnect(socketId: string): void {
    this.sessionStore.deleteBySocketId(socketId);
  }

  // ==================== Private ====================

  /**
   * РСЃРїРѕР»РЅРµРЅРёРµ flow РІ СЂРµР¶РёРјРµ СЃРёРјСѓР»СЏС†РёРё
   */
  private async executeSimulationFlow(
    context: FlowContext,
    session: SimulationSessionData,
    socket: Socket,
  ): Promise<void> {
    const { flow, message } = context;
    const messageText = message.text || "";

    // Как и в проде, slash-команды имеют наивысший приоритет.
    if (messageText.startsWith("/")) {
      if (messageText === "/start") {
        const startNode = flow.nodes.find((n) => n.type === "start");
        if (startNode) {
          context.currentNode = startNode;
          context.session.currentNodeId = startNode.nodeId;
          session.currentNodeId = startNode.nodeId;
          await this.executeNodeWithSimulation(context, session, socket);
          return;
        }
      }

      const commandHandled = await this.tryHandleDirectCommand(context, messageText);
      if (commandHandled) {
        return;
      }

      const commandNode = this.findMatchingNewMessageNode(flow, messageText);
      if (commandNode) {
        context.currentNode = commandNode;
        context.session.currentNodeId = commandNode.nodeId;
        session.currentNodeId = commandNode.nodeId;
        await this.executeNodeWithSimulation(context, session, socket);
        return;
      }
    }

    // Если есть текущий узел — продолжаем выполнение от него.
    if (session.currentNodeId) {
      const currentNode = flow.nodes.find((n) => n.nodeId === session.currentNodeId);
      if (currentNode) {
        context.currentNode = currentNode;
        await this.executeNodeWithSimulation(context, session, socket);
        return;
      }
    }

    // Ищем new_message узлы (глобальные перехваты).
    const newMessageNode = this.findMatchingNewMessageNode(flow, messageText);
    if (newMessageNode) {
      context.currentNode = newMessageNode;
      context.session.currentNodeId = newMessageNode.nodeId;
      session.currentNodeId = newMessageNode.nodeId;
      await this.executeNodeWithSimulation(context, session, socket);
      return;
    }

    this.logger.warn(
      `Симуляция: не найден подходящий узел для сообщения "${messageText}"`,
    );
  }

  private findMatchingNewMessageNode(
    flow: BotFlow,
    text: string,
  ): BotFlowNode | null {
    const newMessageNodes = flow.nodes.filter((n) => n.type === "new_message");
    for (const nmNode of newMessageNodes) {
      const newMessageData = nmNode.data?.newMessage;
      if (!newMessageData?.text) {
        continue;
      }

      const { text: filterText, caseSensitive } = newMessageData;
      const userText = caseSensitive ? text : (text || "").toLowerCase();
      const compareText = caseSensitive ? filterText : filterText.toLowerCase();

      if (userText === compareText) {
        return nmNode;
      }
    }

    return null;
  }

  /**
   * Обработать прямые slash-команды, не связанные с узлами flow:
   * /shop, /booking, а также custom page команды.
   */
  private async tryHandleDirectCommand(
    context: FlowContext,
    commandText: string,
  ): Promise<boolean> {
    const botId = context.bot?.id;
    if (!botId || !commandText.startsWith("/")) {
      return false;
    }

    if (commandText === "/shop") {
      const shop = await this.shopRepository.findOne({ where: { botId } });
      if (shop?.buttonTypes?.includes("command")) {
        const commandSettings = shop.buttonSettings?.command;
        const buttonText = commandSettings?.text || "Открыть магазин";
        const messageText =
          commandSettings?.messageText ||
          shop.description ||
          "Добро пожаловать в наш магазин! Нажмите кнопку ниже, чтобы открыть магазин.";
        const shopUrl =
          shop.url ||
          `${process.env.EXTERNAL_FRONTEND_URL || "https://uforge.online"}/shop/${shop.id}`;

        await this.transportService.sendMessage(
          context.bot,
          context.session.chatId,
          messageText,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: buttonText,
                    web_app: { url: shopUrl },
                  },
                ],
              ],
            },
          },
        );

        return true;
      }
    }

    if (commandText === "/booking") {
      const bookingSystem = await this.bookingSystemRepository.findOne({
        where: { botId },
      });
      if (bookingSystem?.buttonTypes?.includes("command")) {
        const commandSettings = bookingSystem.buttonSettings?.command;
        const buttonText = commandSettings?.text || "Записаться на прием";
        const messageText =
          commandSettings?.messageText ||
          bookingSystem.description ||
          "Добро пожаловать в нашу систему бронирования! Нажмите кнопку ниже, чтобы записаться.";
        const bookingUrl =
          bookingSystem.url ||
          `${process.env.EXTERNAL_FRONTEND_URL || "https://uforge.online"}/booking/${bookingSystem.id}`;

        await this.transportService.sendMessage(
          context.bot,
          context.session.chatId,
          messageText,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: buttonText,
                    web_app: { url: bookingUrl },
                  },
                ],
              ],
            },
          },
        );

        return true;
      }
    }

    const requestedCommand = commandText.replace(/^\//, "").toLowerCase();
    const pages = await this.customPageRepository.find({
      where: {
        botId,
        status: CustomPageStatus.ACTIVE,
      },
    });

    const page = pages.find((candidate) => {
      if (!candidate.botCommand) {
        return false;
      }
      return candidate.botCommand.replace(/^\//, "").toLowerCase() === requestedCommand;
    });

    if (page) {
      await this.transportService.sendMessage(
        context.bot,
        context.session.chatId,
        page.description || "Нажмите кнопку ниже, чтобы открыть страницу.",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Открыть страницу",
                  web_app: { url: page.url },
                },
              ],
            ],
          },
        },
      );

      return true;
    }

    return false;
  }

  private async executeNodeWithSimulation(
    context: FlowContext,
    session: SimulationSessionData,
    socket: Socket,
  ): Promise<void> {
    const { currentNode } = context;
    if (!currentNode) return;

    const nodeType = currentNode.type;

    // РџСЂРѕРІРµСЂСЏРµРј, СЏРІР»СЏРµС‚СЃСЏ Р»Рё СѓР·РµР» РЅРµСЃРёРјСѓР»РёСЂСѓРµРјС‹Рј
    if (NON_SIMULATABLE_NODES.has(nodeType)) {
      const stubMessage = NODE_STUBS[nodeType] || `вљ пёЏ РЈР·РµР» "${nodeType}" РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚СЃСЏ РІ СЃРёРјСѓР»СЏС†РёРё`;
      socket.emit("simulation:bot_message", { text: stubMessage });

      // РџСЂРѕРїСѓСЃРєР°РµРј СѓР·РµР» вЂ” РїРµСЂРµС…РѕРґРёРј Рє СЃР»РµРґСѓСЋС‰РµРјСѓ
      const nextEdge = context.flow.flowData?.edges?.find(
        e => e.source === currentNode.nodeId,
      );
      if (nextEdge) {
        const nextNode = context.flow.nodes.find(n => n.nodeId === nextEdge.target);
        if (nextNode) {
          context.currentNode = nextNode;
          context.session.currentNodeId = nextNode.nodeId;
          session.currentNodeId = nextNode.nodeId;
          await this.executeNodeWithSimulation(context, session, socket);
        }
      }
      return;
    }

    // РЎРїРµС†РёР°Р»СЊРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° periodic_execution
    if (nodeType === "periodic_execution") {
      await this.handlePeriodicSimulation(context, session, socket);
      return;
    }

    // РЎРїРµС†РёР°Р»СЊРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° endpoint (РѕР¶РёРґР°РЅРёРµ РґР°РЅРЅС‹С…)
    if (nodeType === "endpoint" && !context.reachedThroughTransition) {
      session.currentNodeId = currentNode.nodeId;
      context.session.currentNodeId = currentNode.nodeId;

      const endpointConfig = currentNode.data?.endpoint;
      socket.emit("simulation:endpoint_waiting", {
        nodeId: currentNode.nodeId,
        url: endpointConfig?.url || "unknown",
      });
      return;
    }

    // РЎС‚Р°РЅРґР°СЂС‚РЅРѕРµ РІС‹РїРѕР»РЅРµРЅРёРµ С‡РµСЂРµР· Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРЅС‹Р№ handler
    const handler = this.nodeHandlerService.getHandler(nodeType);
    if (handler) {
      // Р’Р°Р¶РЅРѕ: Р·Р°РґР°С‘Рј РєРѕРЅС‚РµРєСЃС‚ РІСЃРµРіРґР°. РџСЂРѕРІРµСЂРєР° С‡РµСЂРµР· `in` Р·РґРµСЃСЊ РЅРµ СЂР°Р±РѕС‚Р°РµС‚
      // РґР»СЏ TypeScript-РїРѕР»РµР№ Р±РµР· runtime-РёРЅРёС†РёР°Р»РёР·Р°С†РёРё.
      (handler as any)._currentContext = context;

      await handler.execute(context);

      // РЎРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµРј СЃРѕСЃС‚РѕСЏРЅРёРµ РѕР±СЂР°С‚РЅРѕ РІ SimulationSessionData
      session.currentNodeId = context.session.currentNodeId;
      session.variables = { ...context.session.variables };
    } else {
      this.logger.warn(`РЎРёРјСѓР»СЏС†РёСЏ: РЅРµРёР·РІРµСЃС‚РЅС‹Р№ С‚РёРї СѓР·Р»Р° "${nodeType}"`);
    }
  }

  /**
   * РЎРёРјСѓР»СЏС†РёСЏ periodic_execution С‡РµСЂРµР· setTimeout
   */
  private async handlePeriodicSimulation(
    context: FlowContext,
    session: SimulationSessionData,
    socket: Socket,
  ): Promise<void> {
    const { currentNode } = context;
    const config = currentNode.data?.periodicExecution;
    if (!config) return;

    const intervalMs = this.getIntervalMs(config);
    const maxExecutions = config.maxExecutions || 5; // Р›РёРјРёС‚РёСЂСѓРµРј РІ СЃРёРјСѓР»СЏС†РёРё
    const nodeId = currentNode.nodeId;

    // РћС‡РёС‰Р°РµРј РїСЂРµРґС‹РґСѓС‰РёР№ С‚Р°Р№РјРµСЂ РµСЃР»Рё Р±С‹Р»
    const existingTimer = session.periodicTimers.get(nodeId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    session.periodicCounts.set(nodeId, 0);

    this.logger.log(`РЎРёРјСѓР»СЏС†РёСЏ periodic: interval=${intervalMs}ms, max=${maxExecutions}`);

    // Р—Р°РїСѓСЃРєР°РµРј РїРµСЂРёРѕРґРёС‡РµСЃРєРѕРµ РІС‹РїРѕР»РЅРµРЅРёРµ
    const executePeriodicTick = async () => {
      const count = (session.periodicCounts.get(nodeId) || 0) + 1;
      session.periodicCounts.set(nodeId, count);

      if (count > maxExecutions) {
        session.periodicTimers.delete(nodeId);
        return;
      }

      socket.emit("simulation:periodic_tick", { nodeId, executionCount: count });

      // Р’С‹РїРѕР»РЅСЏРµРј РґРѕС‡РµСЂРЅРёРµ СѓР·Р»С‹
      const childEdges = context.flow.flowData?.edges?.filter(
        e => e.source === nodeId,
      ) || [];

      for (const edge of childEdges) {
        const childNode = context.flow.nodes.find(n => n.nodeId === edge.target);
        if (childNode) {
          const childContext: FlowContext = {
            ...context,
            currentNode: childNode,
            reachedThroughTransition: true,
          };
          childContext.session.currentNodeId = childNode.nodeId;

          this.transportService.setSocket(socket);
          try {
            await this.executeNodeWithSimulation(childContext, session, socket);
          } finally {
            this.transportService.clearSocket();
          }
        }
      }

      // РџР»Р°РЅРёСЂСѓРµРј СЃР»РµРґСѓСЋС‰РёР№ С‚РёРє
      if (count < maxExecutions) {
        const timer = setTimeout(executePeriodicTick, intervalMs);
        session.periodicTimers.set(nodeId, timer);
      }
    };

    // РџРµСЂРІС‹Р№ С‚РёРє С‡РµСЂРµР· РёРЅС‚РµСЂРІР°Р»
    const timer = setTimeout(executePeriodicTick, Math.min(intervalMs, 10000)); // РњР°РєСЃ 10 СЃРµРє РІ СЃРёРјСѓР»СЏС†РёРё
    session.periodicTimers.set(nodeId, timer);
  }

  /**
   * РџРѕР»СѓС‡РёС‚СЊ РёРЅС‚РµСЂРІР°Р» РІ РјРёР»Р»РёСЃРµРєСѓРЅРґР°С… РёР· РєРѕРЅС„РёРіСѓСЂР°С†РёРё periodic
   */
  private getIntervalMs(config: any): number {
    if (config.scheduleType === "interval") {
      const interval = config.interval || {};
      const seconds =
        (interval.days || 0) * 86400 +
        (interval.hours || 0) * 3600 +
        (interval.minutes || 0) * 60 +
        (interval.seconds || 0);
      return Math.max(seconds * 1000, 5000); // РњРёРЅРёРјСѓРј 5 СЃРµРє
    }
    // Р”Р»СЏ cron вЂ” РёСЃРїРѕР»СЊР·СѓРµРј С„РёРєСЃРёСЂРѕРІР°РЅРЅС‹Р№ РёРЅС‚РµСЂРІР°Р» РІ СЃРёРјСѓР»СЏС†РёРё
    return 10000; // 10 СЃРµРєСѓРЅРґ
  }

  /**
   * РЎРѕР·РґР°С‚СЊ СЃРёРЅС‚РµС‚РёС‡РµСЃРєРёР№ callback_query РґР»СЏ inline-РєРЅРѕРїРѕРє РІ СЃРёРјСѓР»СЏС†РёРё
   */
  private createSyntheticCallbackMessage(
    callbackData: string,
    simulationId: string,
    session: SimulationSessionData,
  ): any {
    const baseMessage = this.createSyntheticMessage(callbackData, session);

    const currentNodeId = session.currentNodeId;
    const savedMessageIdRaw =
      currentNodeId
        ? session.variables?.[`keyboard_${currentNodeId}_sent_message_id`]
        : undefined;
    const savedMessageId = Number(savedMessageIdRaw) || Date.now();

    return {
      ...baseMessage,
      is_callback: true,
      text: callbackData,
      callback_query: {
        id: `sim_cb_${Date.now()}`,
        from: baseMessage.from,
        data: callbackData,
        message: {
          message_id: savedMessageId,
          chat: baseMessage.chat,
        },
      },
      // РЎРѕС…СЂР°РЅСЏРµРј С‚Р°РєР¶Рµ callback_data РЅР° РІРµСЂС…РЅРµРј СѓСЂРѕРІРЅРµ РґР»СЏ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё
      callback_data: callbackData,
      simulationId,
    };
  }

  /**
   * РЎРѕР·РґР°С‚СЊ СЃРёРЅС‚РµС‚РёС‡РµСЃРєРѕРµ Telegram-СЃРѕРѕР±С‰РµРЅРёРµ РґР»СЏ СЃРёРјСѓР»СЏС†РёРё
   */
  private createSyntheticMessage(text: string, session: SimulationSessionData): any {
    return {
      message_id: Date.now(),
      from: {
        id: parseInt(session.simulationId.replace(/\D/g, "").substring(0, 9)) || 999999,
        is_bot: false,
        first_name: "РЎРёРјСѓР»СЏС‚РѕСЂ",
        last_name: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ",
        username: "sim_user",
        language_code: "ru",
      },
      chat: {
        id: parseInt(session.simulationId.replace(/\D/g, "").substring(0, 9)) || 999999,
        type: "private" as const,
        first_name: "РЎРёРјСѓР»СЏС‚РѕСЂ",
        last_name: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ",
      },
      date: Math.floor(Date.now() / 1000),
      text,
    };
  }
}

