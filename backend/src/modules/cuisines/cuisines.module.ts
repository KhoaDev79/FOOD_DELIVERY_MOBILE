import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CuisinesController } from './cuisines.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CuisinesController],
})
export class CuisinesModule {}
