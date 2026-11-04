import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';

/** Link chia sẻ quán/món kèm thẻ xem trước (Open Graph). */
@Module({ controllers: [ShareController] })
export class ShareModule {}
