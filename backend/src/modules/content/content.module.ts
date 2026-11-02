import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ImageStorageService } from './image-storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContentController],
  providers: [ContentService, ImageStorageService],
})
export class ContentModule {}
