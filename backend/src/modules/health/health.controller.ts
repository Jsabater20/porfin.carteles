import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../common/decorators/auth.decorators';

class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;
}

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  check(): HealthResponseDto { return { status: 'ok' }; }

  @Get('ready')
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ description: 'PostgreSQL no está disponible.' })
  async ready(): Promise<HealthResponseDto> {
    // Verifica conexión y que la tabla de la migración inicial esté disponible.
    try { await this.prisma.applicationMetadata.count(); }
    catch { throw new ServiceUnavailableException('Base de datos no disponible.'); }
    return { status: 'ok' };
  }
}
