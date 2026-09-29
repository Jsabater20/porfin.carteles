import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { adminTransaction } from '../../common/utils/admin-transaction';
import { PatchSettingsDto } from './settings.dto';

const defaults = {
  storeName: 'Por fin!', description: '', whatsappNumber: null, contactEmail: null,
  instagramUrl: null, facebookUrl: null, tiktokUrl: null, pickupAddress: '',
  deliveryMethods: [] as string[], deliveryNotes: '', leadTimeText: '', businessHours: '',
};
const publicSelect = {
  storeName: true, description: true, whatsappNumber: true, contactEmail: true,
  instagramUrl: true, facebookUrl: true, tiktokUrl: true, pickupAddress: true,
  deliveryMethods: true, deliveryNotes: true, leadTimeText: true, businessHours: true,
} satisfies Prisma.StoreSettingsSelect;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}
  async publicSettings() {
    const data = await this.prisma.storeSettings.findUnique({ where: { id: 1 }, select: publicSelect }) ?? defaults;
    return { ...data, whatsappUrl: data.whatsappNumber ? 'https://wa.me/' + data.whatsappNumber : null };
  }
  async adminSettings() {
    return await this.prisma.storeSettings.findUnique({ where: { id: 1 } }) ?? { id: 1, ...defaults, updatedAt: null };
  }
  update(dto: PatchSettingsDto, sessionId: string) {
    const data = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));
    if (!Object.keys(data).length) throw new BadRequestException('Indicá los campos a modificar.');
    return adminTransaction(this.prisma, sessionId, tx => tx.storeSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data }));
  }
}
