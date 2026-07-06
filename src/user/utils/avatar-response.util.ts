import {
    ImageVariant,
    MediaFile,
} from '../../media-manager/entities/media-manager.entity';

/** Client-friendly avatar payload (matches auth sign-in / refresh responses). */
export interface AvatarResponseDto {
    id: number;
    originalName?: string;
    url?: string;
    thumbnail?: string;
    medium?: string;
    original?: string;
}

/** Maps a MediaFile (+ optional variants) to the shape consumed by web and mobile clients. */
export function transformAvatarForResponse(
    avatar?: MediaFile | null,
): AvatarResponseDto | undefined {
    if (!avatar) {
        return undefined;
    }

    const response: AvatarResponseDto = {
        id: avatar.id,
        originalName: avatar.originalName,
        url: avatar.url,
        original: avatar.url,
        thumbnail: avatar.url,
        medium: avatar.url,
    };

    if (avatar.variants?.length) {
        for (const variant of avatar.variants) {
            if (variant.variant === ImageVariant.THUMBNAIL) {
                response.thumbnail = variant.url;
            } else if (variant.variant === ImageVariant.MEDIUM) {
                response.medium = variant.url;
            }
        }
    }

    return response;
}
