import { Injectable } from '@nestjs/common';
import { MediaService } from '../media/media.service';
export { ImageFolder } from '../media/media.types';

/**
 * Tương thích ngược: ImageStorageService kế thừa từ MediaService toàn cục.
 */
@Injectable()
export class ImageStorageService extends MediaService {}
