import { DIGITAL_SKILLS_COURSE_ID } from '../constants/digital-skills.constant';

/** True when the course is the existing Digital Skills course (id 50). */
export function isDigitalSkillsCourse(courseId: number | null | undefined): boolean {
    return courseId === DIGITAL_SKILLS_COURSE_ID;
}
