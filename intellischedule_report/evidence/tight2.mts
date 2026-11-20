import { executeOptimizationEngine } from '../src/lib/optimizationEngine';
import { validateTimetableIndependently } from '../src/lib/independentValidator';
import * as D from '../src/lib/initialData';
import type { AcademicYearConfig, CourseAllocation, Faculty, Room, StudentSection, Course } from '../src/types';
type Problem = { academicYear: AcademicYearConfig; allocations: CourseAllocation[]; faculty: Faculty[]; rooms: Room[]; sections: StudentSection[]; courses: Course[] };
function synthetic(S: number, lectureRoomsPerSection = 1.5, labRoomsPerSection = 0.95): Problem {
  const days = D.INITIAL_ACADEMIC_YEAR.workingDays;
  const rooms: Room[] = [];
  const nLect = Math.max(2, Math.ceil(S * lectureRoomsPerSection));
  const nLab = Math.max(2, Math.ceil(S * labRoomsPerSection));
  for (let i = 0; i < nLect; i++) rooms.push({ id: `L${i}`, name: `L${i}`, building: i % 2 ? 'A' : 'B', floor: 1, capacity: 60, type: 'LectureHall', equipment: ['Smart Projector'], isAvailable: true });
  for (let i = 0; i < nLab; i++) rooms.push({ id: `B${i}`, name: `B${i}`, building: 'CC', floor: 1, capacity: 40, type: 'ComputerLab', equipment: ['Smart Projector'], isAvailable: true });
  const courses: Course[] = [];
  const sections: StudentSection[] = [];
  const faculty: Faculty[] = [];
  const allocations: CourseAllocation[] = [];
  const mkFac = (id: string): Faculty => ({
    id, name: id, email: `${id}@x`, departmentId: 'd', designation: 'Assistant Professor', subjectsQualified: [],
    maxDirectTeachingHours: 16, weeklyHoursLimit: 40, status: 'Active',
    preferences: { preferredDays: days, preferredPeriods: [1, 2, 3, 4, 6, 7], protectedSlots: [], maxConsecutivePeriods: 2, availableForMakeup: true, availableForTutorial: true },
  } as any);
  let fc = 0;
  for (let s = 0; s < S; s++) {
    const sid = `S${s}`;
    sections.push({
      id: sid, name: sid, departmentId: 'd', program: 'P', batchYear: 2024, semester: 1, studentCount: 40,
      subSections: [
        { id: `${sid}-1`, sectionId: sid, name: '1', studentCount: 20, type: 'Lab' },
        { id: `${sid}-2`, sectionId: sid, name: '2', studentCount: 20, type: 'Lab' },
      ], status: 'Active',
    } as any);
    for (let c = 0; c < 5; c++) {
      const cid = `C${s}-${c}`;
      const lab = c < 2; // two lab courses per section, like the seeded data (2-3)
      courses.push({ id: cid, code: cid, name: cid, departmentId: 'd', credits: 4, requiredLecturesPerWeek: 3, requiredTutorialsPerWeek: 0, requiredLabsPerWeek: lab ? 2 : 0, totalSemesterHours: 45, completedHours: 0, cancelledHours: 0, requiresLab: lab, requiredEquipment: ['Smart Projector'], primaryFacultyId: '', status: 'Active' } as any);
      // one faculty per 3 lecture allocations => <= 9 h lecture load + labs below
      if (fc % 3 === 0) faculty.push(mkFac(`F${Math.floor(fc / 3)}`));
      allocations.push({ id: `A${allocations.length}`, courseId: cid, facultyId: `F${Math.floor(fc / 3)}`, sectionId: sid, sessionType: 'Lecture', hoursPerWeek: 3, status: 'Allocated' } as any);
      fc++;
      if (lab) for (const sub of [1, 2]) {
        const lf = `LF${s}-${c}-${sub}`;
        faculty.push(mkFac(lf));
        allocations.push({ id: `A${allocations.length}`, courseId: cid, facultyId: lf, sectionId: sid, subSectionId: `${sid}-${sub}`, sessionType: 'Lab', hoursPerWeek: 2, status: 'Allocated' } as any);
      }
    }
  }
  return { academicYear: D.INITIAL_ACADEMIC_YEAR, allocations, faculty, rooms, sections, courses };
}

for (const n of [33, 32, 31, 30, 28]) {
  const p = synthetic(32, n / 32, 0.95);
  const nl = p.rooms.filter(r => r.type === 'LectureHall').length;
  const r = executeOptimizationEngine(p.academicYear, p.allocations, p.faculty, p.rooms, p.sections, p.courses, D.INITIAL_CONSTRAINTS, { budgetMode: 'FAST', timeBudgetMs: 3000, seed: 777, maxCandidates: 1 });
  console.log(JSON.stringify({ lectureRooms: nl, feasible: r.isFeasible, ms: r.metrics.totalTimeMs, backtracks: r.metrics.backtracksCount }));
}
