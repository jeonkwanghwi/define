/**
 * FeedbackModule — 버그 제보 한 덩어리.
 * AuthModule을 import하는 건 MailService를 쓰기 위해서다(SES/콘솔 선택 배선을 그쪽이 들고 있다).
 * PrismaService는 DatabaseModule이 @Global로 제공하므로 import 불필요.
 * JwtAuthGuard의 'jwt' 전략도 AuthModule이 전역 등록한다.
 */
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [AuthModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
