/**
 * 맵별 배경 그림. village-zones.ts를 노드에서 검증할 수 있게(require 없이) 따로 뺐다.
 * 좌표는 전부 이 그림들을 기준으로 한 0~1 비율이다.
 */
import type { ImageSourcePropType } from 'react-native';

import type { ZoneId } from './village-zones';

export const ZONE_BACKGROUNDS: Record<ZoneId, ImageSourcePropType> = {
  center: require('../../assets/village/bg-center.png'),
  east: require('../../assets/village/bg-east-spring.png'),
  south: require('../../assets/village/bg-south-summer.png'),
  west: require('../../assets/village/bg-west-autumn.png'),
  north: require('../../assets/village/bg-north-winter.png'),
};
