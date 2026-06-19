import { AwardXpDto } from './award-xp.dto';

/**
 * Admin manual award request — extends AwardXpDto for POST /rewards/award-xp.
 * Phase 5 will add role-gated controller wiring; service accepts the same shape.
 */
export class CreateRewardDto extends AwardXpDto {}
