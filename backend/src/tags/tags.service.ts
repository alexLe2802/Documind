import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Tag } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTagDto): Promise<Tag> {
    const name = this.normalize(dto.name);
    if (await this.prisma.tag.findUnique({ where: { name } })) {
      throw new ConflictException('Tag name already exists');
    }
    return this.prisma.tag.create({ data: { name } });
  }

  findAll(): Promise<Tag[]> {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string): Promise<Tag> {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  async update(id: string, dto: UpdateTagDto): Promise<Tag> {
    await this.findOne(id);
    const name = dto.name ? this.normalize(dto.name) : undefined;
    if (name) {
      const duplicate = await this.prisma.tag.findUnique({ where: { name } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Tag name already exists');
      }
    }
    return this.prisma.tag.update({ where: { id }, data: { name } });
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);
    await this.prisma.tag.delete({ where: { id } });
    return { message: 'Tag deleted' };
  }

  private normalize(name: string): string {
    return name.trim().toLowerCase();
  }
}
