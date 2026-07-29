import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentStatus, Prisma, Subject } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateSubjectDto): Promise<Subject> {
    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.prisma.subject.findFirst({
      where: { ownerId, code },
    });
    if (duplicate) {
      if (duplicate.deletedAt) {
        try {
          return await this.prisma.subject.update({
            where: { id: duplicate.id },
            data: {
              deletedAt: null,
              name: dto.name.trim(),
              description: dto.description?.trim(),
            },
          });
        } catch (error) {
          this.handlePrismaWriteError(error);
        }
      }

      return duplicate;
    }

    try {
      return await this.prisma.subject.create({
        data: {
          ownerId,
          code,
          name: dto.name.trim(),
          description: dto.description?.trim(),
        },
      });
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  findAll(ownerId: string): Promise<Subject[]> {
    return this.prisma.subject.findMany({
      where: this.buildVisibleWhere(ownerId),
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, ownerId: string): Promise<Subject> {
    const subject = await this.prisma.subject.findFirst({
      where: { id, ...this.buildVisibleWhere(ownerId) },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateSubjectDto,
  ): Promise<Subject> {
    await this.findOne(id, ownerId);
    const code = dto.code?.trim().toUpperCase();
    if (code) {
      const duplicate = await this.prisma.subject.findFirst({
        where: { ownerId, code },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Subject code already exists');
      }
    }

    try {
      return await this.prisma.subject.update({
        where: { id },
        data: {
          code,
          name: dto.name?.trim(),
          description: dto.description?.trim(),
        },
      });
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async remove(id: string, ownerId: string): Promise<{ message: string }> {
    const subject = await this.findOne(id, ownerId);
    if (subject.ownerId && subject.ownerId !== ownerId) {
      throw new BadRequestException(
        'Cannot delete a subject owned by another user',
      );
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.document.updateMany({
        where: {
          ownerId,
          subjectId: id,
          status: { not: DocumentStatus.DELETED },
        },
        data: { status: DocumentStatus.DELETED },
      }),
    ];

    if (subject.ownerId === ownerId) {
      operations.push(
        this.prisma.category.updateMany({
          where: {
            ownerId,
            subjectId: id,
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        }),
        this.prisma.subject.update({
          where: { id },
          data: { deletedAt: new Date() },
        }),
      );
    }

    await this.prisma.$transaction(operations);

    return { message: 'Subject deleted' };
  }

  private buildVisibleWhere(ownerId: string): Prisma.SubjectWhereInput {
    return {
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
    };
  }

  private handlePrismaWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Subject code already exists');
      }

      if (error.code === 'P2003') {
        throw new BadRequestException('Subject owner does not exist');
      }
    }

    throw error;
  }
}
