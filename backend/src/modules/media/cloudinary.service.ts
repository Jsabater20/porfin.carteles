import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { MEDIA_FORMATS } from './media.constants';

export interface CloudinaryAsset {
  asset_id: string;
  public_id: string;
  resource_type: string;
  type: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  secure_url: string;
}

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {}

  get cloudName(): string { return this.config.get<string>('CLOUDINARY_CLOUD_NAME', ''); }
  get enabled(): boolean {
    return ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_UPLOAD_PRESET'].every(key => !!this.config.get<string>(key));
  }

  private options() {
    if (!this.enabled) throw new ServiceUnavailableException('Configurá Cloudinary y el preset firmado para habilitar las cargas.');
    // Credenciales por llamada, sin modificar el singleton global del SDK.
    return { cloud_name: this.cloudName, api_key: this.config.getOrThrow<string>('CLOUDINARY_API_KEY'), api_secret: this.config.getOrThrow<string>('CLOUDINARY_API_SECRET'), timeout: 10000 };
  }

  async validatePreset() {
    const options = this.options();
    try {
      const preset = await cloudinary.api.upload_preset(this.config.getOrThrow<string>('CLOUDINARY_UPLOAD_PRESET'), options);
      const settings = preset.settings ?? {};
      const formats: string[] = Array.isArray(settings.allowed_formats) ? settings.allowed_formats : String(settings.allowed_formats ?? '').split(',');
      // Cloudinary does not support per-preset file size limits. MediaService
      // checks the provider's actual bytes before accepting an image.
      const usesFolderPrefix = ![undefined, null, false, 0, '0', 'false'].includes(settings.use_asset_folder_as_public_id_prefix);
      if (preset.unsigned !== false || !formats.length || formats.some(format => !MEDIA_FORMATS.includes(format)) || settings.folder || settings.public_id_prefix || usesFolderPrefix || settings.transformation || (settings.type && settings.type !== 'upload')) {
        throw new Error('Preset incompatible');
      }
    } catch {
      throw new ServiceUnavailableException('El preset de Cloudinary debe ser firmado y permitir solo JPG, PNG o WebP, con entrega pública y sin prefijos ni transformaciones de entrada.');
    }
  }

  sign(publicId: string, timestamp: number) {
    const options = this.options();
    const params = { timestamp, public_id: publicId, upload_preset: this.config.getOrThrow<string>('CLOUDINARY_UPLOAD_PRESET'), overwrite: false, allowed_formats: MEDIA_FORMATS.join(',') };
    return { uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`, apiKey: options.api_key, params, signature: cloudinary.utils.api_sign_request(params, options.api_secret) };
  }

  async inspect(publicId: string): Promise<CloudinaryAsset> {
    const options = this.options();
    try {
      return await cloudinary.api.resource(publicId, { ...options, resource_type: 'image', type: 'upload' }) as CloudinaryAsset;
    } catch (error) {
      if ((error as { error?: { http_code?: number }; http_code?: number })?.error?.http_code === 404 || (error as { http_code?: number })?.http_code === 404) throw new ConflictException('La imagen todavía no está disponible en Cloudinary.');
      throw new ServiceUnavailableException('No se pudo verificar la imagen en Cloudinary. Reintentá la confirmación.');
    }
  }

  async destroy(publicId: string) {
    const options = this.options();
    // resource_type no forma parte de la firma. Limpiar también una carga
    // abandonada que se haya enviado a otro endpoint del proveedor.
    for (const resource_type of ['image', 'video', 'raw'] as const) {
      const result = await cloudinary.uploader.destroy(publicId, { ...options, resource_type, type: 'upload', invalidate: true });
      if (result.result !== 'ok' && result.result !== 'not found') throw new Error('Cloudinary no confirmó la eliminación.');
    }
  }
}
