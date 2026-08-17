import {
    countCharacters,
    hashTranslationSource,
    hasTextChanged,
    isEmptyTranslationText,
    splitIntoCharacterBatches,
} from './translation-text.util';

describe('translation-text.util', () => {
    it('treats blank and whitespace-only values as empty', () => {
        expect(isEmptyTranslationText(null)).toBe(true);
        expect(isEmptyTranslationText('   ')).toBe(true);
        expect(isEmptyTranslationText('Safety')).toBe(false);
    });

    it('detects normalized text changes', () => {
        expect(hasTextChanged('Hello', 'Hello')).toBe(false);
        expect(hasTextChanged('Hello  world', 'Hello world')).toBe(false);
        expect(hasTextChanged('Hello', 'Olá')).toBe(true);
    });

    it('produces a stable hash for the same fields', () => {
        const first = hashTranslationSource({
            title: 'First Aid',
            description: 'Learn CPR',
        });
        const second = hashTranslationSource({
            description: 'Learn CPR',
            title: 'First Aid',
        });
        expect(first).toBe(second);
        expect(first).toHaveLength(64);
    });

    it('splits strings so each batch stays under the character cap', () => {
        const batches = splitIntoCharacterBatches(
            ['aaaa', 'bbbb', 'cccc'],
            8,
        );

        expect(batches).toEqual([['aaaa', 'bbbb'], ['cccc']]);
        expect(countCharacters(['aa', 'bb'])).toBe(4);
    });
});
