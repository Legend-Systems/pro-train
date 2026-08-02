import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';

import { toNullableDate } from '../utils/exam-window.util';

/**
 * Validates that the exam window end is not before its start.
 * Applied to `examEndDate` so the error surfaces on the field the admin
 * most likely needs to correct.
 */
@ValidatorConstraint({ name: 'isExamWindowOrdered', async: false })
class ExamWindowOrderConstraint implements ValidatorConstraintInterface {
    validate(_value: unknown, args: ValidationArguments): boolean {
        const dto = args.object as {
            examStartDate?: string | Date | null;
            examEndDate?: string | Date | null;
        };

        const start = toNullableDate(dto.examStartDate);
        const end = toNullableDate(dto.examEndDate);

        // Ordering can only be checked when both boundaries are supplied.
        if (!start || !end) {
            return true;
        }

        return start.getTime() <= end.getTime();
    }

    defaultMessage(): string {
        return 'examEndDate must be the same as or after examStartDate';
    }
}

/** Ensures `examStartDate <= examEndDate` when both are provided. */
export function IsExamWindowOrdered(
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return function registerExamWindowOrder(
        target: object,
        propertyName: string | symbol,
    ): void {
        registerDecorator({
            target: target.constructor,
            propertyName: propertyName as string,
            options: validationOptions,
            constraints: [],
            validator: ExamWindowOrderConstraint,
        });
    };
}
