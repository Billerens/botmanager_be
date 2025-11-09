import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Service } from "../../../database/entities/service.entity";
import { Specialist } from "../../../database/entities/specialist.entity";
import { Bot } from "../../../database/entities/bot.entity";
import { CreateServiceDto, UpdateServiceDto } from "../dto/booking.dto";
import { BookingStatus } from "../../../database/entities/booking.entity";
import { ActivityLogService } from "../../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../../database/entities/activity-log.entity";

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Specialist)
    private specialistRepository: Repository<Specialist>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    private activityLogService: ActivityLogService
  ) {}

  async create(
    createServiceDto: CreateServiceDto,
    botId: string
  ): Promise<Service> {
    // Проверяем, что все специалисты существуют и принадлежат боту
    const specialists = await this.specialistRepository.findBy({
      id: In(createServiceDto.specialistIds),
      botId,
    });

    if (specialists.length !== createServiceDto.specialistIds.length) {
      throw new NotFoundException("Один или несколько специалистов не найдены");
    }

    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const { specialistIds, ...serviceData } = createServiceDto;
    const service = this.serviceRepository.create({
      ...serviceData,
      specialists,
    });
    const savedService = await this.serviceRepository.save(service);

    // Логируем создание услуги
    if (bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.SERVICE_CREATED,
          level: ActivityLevel.SUCCESS,
          message: `Создана услуга "${savedService.name}"`,
          userId: bot.ownerId,
          botId,
          metadata: {
            serviceId: savedService.id,
            serviceName: savedService.name,
            duration: savedService.duration,
            price: savedService.price,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования создания услуги:", error);
        });
    }

    return savedService;
  }

  async findAll(botId: string): Promise<Service[]> {
    return this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .where("specialist.botId = :botId", { botId })
      .andWhere("service.isActive = :isActive", { isActive: true })
      .orderBy("service.name", "ASC")
      .getMany();
  }

  async findBySpecialist(
    specialistId: string,
    botId: string
  ): Promise<Service[]> {
    // Проверяем, что специалист принадлежит боту
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, botId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    return this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .where("specialist.id = :specialistId", { specialistId })
      .andWhere("service.isActive = :isActive", { isActive: true })
      .orderBy("service.name", "ASC")
      .getMany();
  }

  async findOne(id: string, botId: string): Promise<Service> {
    const service = await this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .leftJoinAndSelect("service.bookings", "bookings")
      .where("service.id = :id", { id })
      .andWhere("specialist.botId = :botId", { botId })
      .getOne();

    if (!service) {
      throw new NotFoundException("Услуга не найдена");
    }

    return service;
  }

  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
    botId: string
  ): Promise<Service> {
    const service = await this.findOne(id, botId);
    const bot = await this.botRepository.findOne({ where: { id: botId } });

    // Если обновляются специалисты, проверяем их существование
    if (updateServiceDto.specialistIds) {
      const specialists = await this.specialistRepository.findBy({
        id: In(updateServiceDto.specialistIds),
        botId,
      });

      if (specialists.length !== updateServiceDto.specialistIds.length) {
        throw new NotFoundException(
          "Один или несколько специалистов не найдены"
        );
      }

      service.specialists = specialists;
    }

    const { specialistIds, ...serviceData } = updateServiceDto;
    Object.assign(service, serviceData);

    const updatedService = await this.serviceRepository.save(service);

    // Логируем обновление услуги
    if (bot && bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.SERVICE_UPDATED,
          level: ActivityLevel.SUCCESS,
          message: `Обновлена услуга "${updatedService.name}"`,
          userId: bot.ownerId,
          botId,
          metadata: {
            serviceId: updatedService.id,
            serviceName: updatedService.name,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования обновления услуги:", error);
        });
    }

    return updatedService;
  }

  async remove(id: string, botId: string): Promise<void> {
    const service = await this.findOne(id, botId);
    const bot = await this.botRepository.findOne({ where: { id: botId } });

    // Проверяем, есть ли активные бронирования
    const activeBookings = await this.serviceRepository
      .createQueryBuilder("service")
      .leftJoin("service.bookings", "booking")
      .where("service.id = :id", { id })
      .andWhere("booking.status IN (:...statuses)", {
        statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      })
      .getCount();

    if (activeBookings > 0) {
      throw new BadRequestException(
        "Нельзя удалить услугу с активными бронированиями"
      );
    }

    const serviceName = service.name;
    await this.serviceRepository.remove(service);

    // Логируем удаление услуги
    if (bot && bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.SERVICE_DELETED,
          level: ActivityLevel.SUCCESS,
          message: `Удалена услуга "${serviceName}"`,
          userId: bot.ownerId,
          botId,
          metadata: {
            serviceId: id,
            serviceName,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования удаления услуги:", error);
        });
    }
  }

  async getServicesByCategory(
    botId: string,
    category?: string
  ): Promise<Service[]> {
    const query = this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .where("specialist.botId = :botId", { botId })
      .andWhere("service.isActive = :isActive", { isActive: true });

    if (category) {
      query.andWhere("service.category = :category", { category });
    }

    return query.orderBy("service.name", "ASC").getMany();
  }

  async getPopularServices(
    botId: string,
    limit: number = 10
  ): Promise<Service[]> {
    return this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .leftJoin("service.bookings", "booking")
      .where("specialist.botId = :botId", { botId })
      .andWhere("service.isActive = :isActive", { isActive: true })
      .groupBy("service.id")
      .addGroupBy("specialist.id")
      .orderBy("COUNT(booking.id)", "DESC")
      .limit(limit)
      .getMany();
  }
}
