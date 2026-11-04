import { Global, Module } from '@nestjs/common';
import { ImageStorageService } from '../content/image-storage.service';
import { MediaService } from './media.service';

@Global()
@Module({
  providers: [MediaService, ImageStorageService],
  exports: [MediaService, ImageStorageService],
})
export class MediaModule {}

