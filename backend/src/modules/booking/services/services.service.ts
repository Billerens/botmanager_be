import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Service } from "../../../database/entities/service.entity";
import { Specialist } from "../../../database/entities/specialist.entity";
import { CreateServiceDto, UpdateServiceDto } from "../dto/booking.dto";
import { BookingStatus } from "../../../database/entities/booking.entity";

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Specialist)
    private specialistRepository: Repository<Specialist>
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

    const { specialistIds, ...serviceData } = createServiceDto;
    const service = this.serviceRepository.create({
      ...serviceData,
      specialists,
    });
    return this.serviceRepository.save(service);
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

    return this.serviceRepository.save(service);
  }

  async remove(id: string, botId: string): Promise<void> {
    const service = await this.findOne(id, botId);

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

    await this.serviceRepository.remove(service);
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
