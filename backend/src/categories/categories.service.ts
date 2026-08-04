import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Category, DocumentStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(ownerId: string, dto: CreateCategoryDto): Promise<Category> {
    await this.findSubjectForUser(dto.subjectId, ownerId);
    const name = dto.name.trim();
    const duplicate = await this.prisma.category.findFirst({
      where: { ownerId, subjectId: dto.subjectId, name, deletedAt: null },
    });
    if (duplicate) {
      throw new ConflictException('Category name already exists');
    }

    return this.prisma.category.create({
      data: {
        ownerId,
        subjectId: dto.subjectId,
        name,
        description: dto.description?.trim(),
      },
    });
  }

  findAll(ownerId: string, subjectId?: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: this.buildVisibleWhere(ownerId, subjectId),
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, ownerId: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: { id, ...this.buildVisibleWhere(ownerId) },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id, ownerId);
    const categoryWithSubject = category as Category & {
      subjectId?: string | null;
    };
    const subjectId = dto.subjectId ?? categoryWithSubject.subjectId;
    if (!subjectId) {
      throw new BadRequestException('Category must belong to a subject');
    }
    if (dto.subjectId) {
      await this.findSubjectForUser(dto.subjectId, ownerId);
    }

    const name = dto.name?.trim();
    if (name) {
      const duplicate = await this.prisma.category.findFirst({
        where: { ownerId, subjectId, name, deletedAt: null },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Category name already exists');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        subjectId: dto.subjectId,
        name,
        description: dto.description?.trim(),
      },
    });
  }

  async remove(id: string, ownerId: string): Promise<{ message: string }> {
    const category = await this.findOne(id, ownerId);
    if (category.ownerId && category.ownerId !== ownerId) {
      throw new BadRequestException(
        'Cannot delete a category owned by another user',
      );
    }

    const documentWhere = { ownerId, categoryId: id };
    const documents = await this.prisma.document.findMany({
      where: documentWhere,
      select: { id: true, storagePath: true },
    });
    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.document.deleteMany({ where: documentWhere }),
    ];

    if (category.ownerId === ownerId) {
      operations.push(
        this.prisma.category.update({
          where: { id },
          data: { deletedAt: new Date() },
        }),
      );
    }

    await this.prisma.$transaction(operations);
    await this.deleteStorageObjects(ownerId, documents);

    return { message: 'Category deleted' };
  }

  private async deleteStorageObjects(
    ownerId: string,
    documents: Array<{ id: string; storagePath: string }>,
  ): Promise<void> {
    await Promise.all(
      documents.map((document) =>
        Promise.resolve(this.storage.deleteObject(ownerId, document.storagePath)).catch(
          (error: unknown) =>
            this.logger.warn(
              `Document ${document.id} was deleted from the database, but its storage object could not be removed: ${error instanceof Error ? error.message : String(error)}`,
            ),
        ),
      ),
    );
  }

  private buildVisibleWhere(
    ownerId: string,
    subjectId?: string,
  ): Prisma.CategoryWhereInput {
    const subjectFilter: Prisma.CategoryWhereInput = subjectId
      ? {
          OR: [
            { subjectId },
            {
              documents: {
                some: {
                  ownerId,
                  subjectId,
                  status: { not: DocumentStatus.DELETED },
                },
              },
            },
          ],
        }
      : {};

    return {
      deletedAt: null,
      AND: [
        subjectFilter,
        {
          OR: [
            { ownerId },
            {
              ownerId: null,
              documents: {
                some: {
                  ownerId,
                  status: { not: DocumentStatus.DELETED },
                },
              },
            },
          ],
        },
      ],
    };
  }

  private async findSubjectForUser(id: string, ownerId: string): Promise<void> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { ownerId },
          {
            ownerId: null,
            documents: {
              some: {
                ownerId,
                status: { not: DocumentStatus.DELETED },
              },
            },
          },
        ],
      },
    });
    if (!subject) throw new NotFoundException('Subject not found');
  }
}
