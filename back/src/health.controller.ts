/**
 * HealthController — 배포 플랫폼(App Runner 등)의 헬스체크용 최소 엔드포인트.
 * GET /api/health → { status: 'ok' }
 *
 * 일부러 DB를 건드리지 않는다: 여기서 확인하려는 건 "컨테이너가 요청을 받고 있는가"이고,
 * DB 순간 장애로 컨테이너가 통째로 교체되는 걸 원하지 않기 때문.
 */
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
