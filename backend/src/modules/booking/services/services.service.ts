import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
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
    // Проверяем, что специалист существует и принадлежит боту
    const specialist = await this.specialistRepository.findOne({
      where: { id: createServiceDto.specialistId, botId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    const service = this.serviceRepository.create(createServiceDto);
    return this.serviceRepository.save(service);
  }

  async findAll(botId: string): Promise<Service[]> {
    return this.serviceRepository.find({
      where: {
        specialist: { botId },
        isActive: true,
      },
      relations: ["specialist"],
      order: { name: "ASC" },
    });
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

    return this.serviceRepository.find({
      where: {
        specialistId,
        isActive: true,
      },
      relations: ["specialist"],
      order: { name: "ASC" },
    });
  }

  async findOne(id: string, botId: string): Promise<Service> {
    const service = await this.serviceRepository.findOne({
      where: {
        id,
        specialist: { botId },
      },
      relations: ["specialist", "bookings"],
    });

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

    Object.assign(service, updateServiceDto);

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
      .leftJoin("service.specialist", "specialist")
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
      .leftJoin("service.specialist", "specialist")
      .leftJoin("service.bookings", "booking")
      .where("specialist.botId = :botId", { botId })
      .andWhere("service.isActive = :isActive", { isActive: true })
      .groupBy("service.id")
      .orderBy("COUNT(booking.id)", "DESC")
      .limit(limit)
      .getMany();
  }
}
