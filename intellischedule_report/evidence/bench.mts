// Independent measurement harness for the IntelliSchedule report.
// Imports the engine as-is from the cloned repository; nothing in the repo is modified.
import { executeOptimizationEngine, type EngineOptions } from '../src/lib/optimizationEngine';
import { validateTimetableIndependently } from '../src/lib/independentValidator';
import { findSelfHealingRecoverySlots } from '../src/lib/recoveryEngine';
import * as D from '../src/lib/initialData';
import type {
  AcademicYearConfig, CourseAllocation, Faculty, Room, StudentSection, Course, ClassSession, MakeupTask,
} from '../src/types';
import os from 'node:os';
import fs from 'node:fs';

const out: Record<string, unknown> = {};
const log = (...a: unknown[]) => console.log(...a);

const pct = (arr: number[], p: number) => {
  const s = [...arr].sort((a, b) => a - b);
  if (!s.length) return 0;
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
};
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
};
const r2 = (x: number) => Number(x.toFixed(2));

type Problem = {
  academicYear: AcademicYearConfig;
  allocations: CourseAllocation[];
  faculty: Faculty[];
  rooms: Room[];
  sections: StudentSection[];
  courses: Course[];
};

const realProblem: Problem = {
  academicYear: D.INITIAL_ACADEMIC_YEAR,
  allocations: D.INITIAL_ALLOCATIONS,
  faculty: D.FACULTY_MEMBERS,
  rooms: D.ROOMS,
  sections: D.SECTIONS,
  courses: D.COURSES,
};

function run(p: Problem, opts: EngineOptions) {
  return executeOptimizationEngine(
    p.academicYear, p.allocations, p.faculty, p.rooms, p.sections, p.courses, D.INITIAL_CONSTRAINTS, opts,
  );
}

function validate(p: Problem, sessions: ClassSession[]) {
  return validateTimetableIndependently(sessions, {
    academicYear: p.academicYear,
    allocations: p.allocations,
    facultyMembers: p.faculty,
    rooms: p.rooms,
    sections: p.sections,
    courses: p.courses,
    constraints: D.INITIAL_CONSTRAINTS,
  } as any);
}

// ---------------------------------------------------------------- E0 environment
out.environment = {
  node: process.version,
  platform: `${os.type()} ${os.release()} ${os.arch()}`,
  cpu: os.cpus()[0]?.model,
  cores: os.cpus().length,
  memGB: r2(os.totalmem() / 1024 ** 3),
};
log('ENV', out.environment);

// ---------------------------------------------------------------- E1 dataset statistics
{
  const teaching = realProblem.academicYear.timeSlots.filter(t => !t.isBreak && !t.isLunch);
  const byType: Record<string, number> = {};
  realProblem.rooms.forEach(r => { byType[r.type] = (byType[r.type] || 0) + 1; });
  const lect = realProblem.allocations.filter(a => a.sessionType === 'Lecture');
  const labs = realProblem.allocations.filter(a => a.sessionType === 'Lab');
  const hours = realProblem.allocations.reduce((s, a) => s + a.hoursPerWeek, 0);
  const facUsed = new Set(realProblem.allocations.map(a => a.facultyId));
  const facLoad = new Map<string, number>();
  realProblem.allocations.forEach(a => facLoad.set(a.facultyId, (facLoad.get(a.facultyId) || 0) + a.hoursPerWeek));
  const secLoad = new Map<string, number>();
  realProblem.allocations.forEach(a => {
    // whole-section hours: lectures + (lab hours of one subgroup, subgroups run in parallel ideally)
    if (!a.subSectionId) secLoad.set(a.sectionId, (secLoad.get(a.sectionId) || 0) + a.hoursPerWeek);
  });
  const labHoursPerSec = new Map<string, number>();
  labs.forEach(a => labHoursPerSec.set(a.sectionId, (labHoursPerSec.get(a.sectionId) || 0) + a.hoursPerWeek));
  out.dataset = {
    workingDays: realProblem.academicYear.workingDays.length,
    teachingPeriodsPerDay: teaching.length,
    weeklySlots: realProblem.academicYear.workingDays.length * teaching.length,
    faculty: realProblem.faculty.length,
    facultyWithAllocations: facUsed.size,
    maxFacultyLoad: Math.max(...facLoad.values()),
    rooms: realProblem.rooms.length,
    roomsByType: byType,
    sections: realProblem.sections.length,
    subgroups: realProblem.sections.reduce((s, x) => s + (x.subSections?.length || 0), 0),
    students: D.STUDENTS.length,
    courses: realProblem.courses.length,
    allocations: realProblem.allocations.length,
    lectureAllocations: lect.length,
    labAllocations: labs.length,
    weeklySessionHours: hours,
    lectureHours: lect.reduce((s, a) => s + a.hoursPerWeek, 0),
    labHours: labs.reduce((s, a) => s + a.hoursPerWeek, 0),
    sectionLectureHoursRange: [Math.min(...secLoad.values()), Math.max(...secLoad.values())],
    sectionLabHoursRange: [Math.min(...labHoursPerSec.values()), Math.max(...labHoursPerSec.values())],
  };
  log('DATASET', out.dataset);
}

// ---------------------------------------------------------------- E2 Phase A vs Phase B on the seeded dataset
if (!process.env.SKIP_DONE) {
  const profiles = ['BALANCED', 'STUDENT_FOCUSED', 'FACULTY_FOCUSED'] as const;
  const seeds = Array.from({ length: 10 }, (_, i) => 101 + i * 7);
  const rows: any[] = [];
  for (const profile of profiles) {
    const pre: number[] = [], post: number[] = [], tA: number[] = [], tTot: number[] = [], tB: number[] = [];
    const hard: number[] = [], warn: number[] = [], bt: number[] = [], hsPre: number[] = [], hsPost: number[] = [];
    const compPre: Record<string, number[]> = {}, compPost: Record<string, number[]> = {};
    let maxEqualsBalanced = 0;
    for (const seed of seeds) {
      const fast = run(realProblem, { budgetMode: 'FAST', seed, optimizationProfile: profile, maxCandidates: 1 });
      const bal = run(realProblem, { budgetMode: 'BALANCED', timeBudgetMs: 800, seed, optimizationProfile: profile, maxCandidates: 1 });
      const mx = run(realProblem, { budgetMode: 'MAXIMUM_OPTIMIZATION', timeBudgetMs: 2000, seed, optimizationProfile: profile, maxCandidates: 1 });
      const f = fast.bestCandidate!, b = bal.bestCandidate!;
      pre.push(f.softPenalty.totalPenalty);
      post.push(b.softPenalty.totalPenalty);
      hsPre.push(f.healthScore); hsPost.push(b.healthScore);
      tA.push(fast.metrics.totalTimeMs);
      tTot.push(bal.metrics.totalTimeMs);
      tB.push(bal.metrics.optimizationTimeMs);
      bt.push(fast.metrics.backtracksCount);
      if (Math.abs((mx.bestCandidate?.softPenalty.totalPenalty ?? -1) - b.softPenalty.totalPenalty) < 1e-9) maxEqualsBalanced++;
      for (const k of Object.keys(f.softPenalty)) {
        const v = (f.softPenalty as any)[k];
        if (typeof v === 'number') (compPre[k] ||= []).push(v);
        const w = (b.softPenalty as any)[k];
        if (typeof w === 'number') (compPost[k] ||= []).push(w);
      }
      const v = validate(realProblem, b.sessions);
      hard.push(v.hardViolationsCount);
      warn.push(v.warningCount);
    }
    const comp: Record<string, [number, number]> = {};
    for (const k of Object.keys(compPre)) comp[k] = [r2(mean(compPre[k])), r2(mean(compPost[k] || []))];
    const reductions = pre.map((x, i) => (x - post[i]) / x * 100);
    rows.push({
      profile,
      runs: seeds.length,
      prePenaltyMean: r2(mean(pre)), prePenaltySd: r2(sd(pre)),
      postPenaltyMean: r2(mean(post)), postPenaltySd: r2(sd(post)),
      reductionPctMean: r2(mean(reductions)), reductionPctMin: r2(Math.min(...reductions)), reductionPctMax: r2(Math.max(...reductions)),
      healthPre: [Math.min(...hsPre), Math.max(...hsPre)], healthPost: [Math.min(...hsPost), Math.max(...hsPost)],
      phaseAOnlyMsP50: r2(pct(tA, 50)), phaseAOnlyMsP95: r2(pct(tA, 95)),
      balancedTotalMsP50: r2(pct(tTot, 50)), balancedPhaseBMsP50: r2(pct(tB, 50)),
      phaseABacktracksMax: Math.max(...bt),
      validatorHardMax: Math.max(...hard), validatorWarningsMean: r2(mean(warn)),
      maxOptSamePenaltyAsBalanced: `${maxEqualsBalanced}/${seeds.length}`,
      components: comp,
    });
    log('E2', profile, JSON.stringify(rows[rows.length - 1]));
  }
  out.phaseAB = rows;
}

// ---------------------------------------------------------------- E2b which hard rules does Phase B break?
{
  const codes: Record<string, number> = {};
  const fastCodes: Record<string, number> = {};
  const examples: string[] = [];
  let runsWithHard = 0;
  const seeds = Array.from({ length: 10 }, (_, i) => 101 + i * 7);
  for (const profile of ['BALANCED', 'STUDENT_FOCUSED', 'FACULTY_FOCUSED'] as const) for (const seed of seeds) {
    const fast = run(realProblem, { budgetMode: 'FAST', seed, optimizationProfile: profile, maxCandidates: 1 });
    const vf = validate(realProblem, fast.bestCandidate!.sessions);
    vf.violations.filter(v => v.severity === 'CRITICAL').forEach(v => { fastCodes[v.code] = (fastCodes[v.code] || 0) + 1; });
    const bal = run(realProblem, { budgetMode: 'BALANCED', timeBudgetMs: 800, seed, optimizationProfile: profile, maxCandidates: 1 });
    const v = validate(realProblem, bal.bestCandidate!.sessions);
    const hard = v.violations.filter(x => x.severity === 'CRITICAL');
    if (hard.length) runsWithHard++;
    hard.forEach(x => { codes[x.code] = (codes[x.code] || 0) + 1; if (examples.length < 4) examples.push(x.message.slice(0, 220)); });
  }
  out.phaseBViolations = { runs: 30, runsWithHard, codesAfterPhaseB: codes, codesAfterPhaseAOnly: fastCodes, examples };
  log('E2b', JSON.stringify(out.phaseBViolations));
}

// ---------------------------------------------------------------- E2c default dual routines used by the server
{
  const rows: any[] = [];
  for (const [profile, seed] of [['STUDENT_FOCUSED', 1337], ['FACULTY_FOCUSED', 9999]] as const) {
    const r = run(realProblem, { budgetMode: 'BALANCED', optimizationProfile: profile, timeBudgetMs: 800, seed, maxCandidates: 1 });
    const v = validate(realProblem, r.bestCandidate!.sessions);
    rows.push({ profile, seed, penalty: r.bestCandidate!.softPenalty.totalPenalty, health: r.bestCandidate!.healthScore, hard: v.hardViolationsCount, codes: v.violations.filter(x => x.severity === 'CRITICAL').map(x => x.code), warnings: v.warningCount, canPublish: v.canPublish, ms: r.metrics.totalTimeMs });
  }
  out.dualRoutines = rows;
  log('E2c', JSON.stringify(rows));
}

// ---------------------------------------------------------------- E3 multi-candidate diversity
if (!process.env.SKIP_DONE) {
  const res = run(realProblem, { budgetMode: 'FAST', seed: 1337, maxCandidates: 1 });
  const res3 = executeOptimizationEngine(
    realProblem.academicYear, realProblem.allocations, realProblem.faculty, realProblem.rooms, realProblem.sections,
    realProblem.courses, D.INITIAL_CONSTRAINTS, { budgetMode: 'MAXIMUM_OPTIMIZATION', timeBudgetMs: 400, seed: 1337, maxCandidates: 3 },
  );
  // Compare raw Phase A placements: re-run with BALANCED but read candidates before Phase B is impossible from outside,
  // so measure diversity of final candidates by (course,section,subSection,day,slot) multiset overlap.
  const key = (s: ClassSession) => `${s.courseId}|${s.sectionId}|${s.subSectionId || ''}|${s.day}|${s.timeSlotId}`;
  const cands = res3.allCandidates;
  const overlaps: number[] = [];
  for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
    const a = new Map<string, number>();
    cands[i].sessions.forEach(s => a.set(key(s), (a.get(key(s)) || 0) + 1));
    let common = 0;
    cands[j].sessions.forEach(s => { const c = a.get(key(s)) || 0; if (c > 0) { common++; a.set(key(s), c - 1); } });
    overlaps.push(r2(common / cands[j].sessions.length * 100));
  }
  out.diversity = { candidates: cands.length, pairwiseOverlapPct: overlaps, fastSessions: res.bestCandidate?.sessions.length };
  log('E3', out.diversity);
}

// ---------------------------------------------------------------- E4 scaling on a feasible synthetic family
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

{
  const sizes = [4, 8, 16, 32, 64, 80, 96, 112, 128];
  const rows: any[] = [];
  for (const S of sizes) {
    const p = synthetic(S);
    const t: number[] = [], comp: number[] = [], feas: number[] = [], bt: number[] = [];
    let feasibleRuns = 0, hardMax = 0, sessions = 0;
    const N = S >= 64 ? 10 : 20;
    let crashed = '';
    for (let i = 0; i < N; i++) {
      let res;
      try { res = run(p, { budgetMode: 'FAST', timeBudgetMs: 3000, seed: 500 + i, maxCandidates: 1 }); }
      catch (e: any) { crashed = String(e?.message || e).slice(0, 60); break; }
      t.push(res.metrics.totalTimeMs); comp.push(res.metrics.compilationTimeMs); feas.push(res.metrics.feasibilityTimeMs);
      bt.push(res.metrics.backtracksCount);
      if (res.isFeasible && res.bestCandidate) {
        feasibleRuns++;
        sessions = res.bestCandidate.sessions.length;
        const v = validate(p, res.bestCandidate.sessions);
        hardMax = Math.max(hardMax, v.hardViolationsCount);
      }
    }
    if (crashed) { rows.push({ sections: S, allocations: p.allocations.length, sessionHours: p.allocations.reduce((s, a) => s + a.hoursPerWeek, 0), crashed }); log('E4', JSON.stringify(rows[rows.length - 1])); continue; }
    // one BALANCED run to see Phase B cost at this size
    const balT: number[] = [];
    let balCrash = 0;
    for (let i = 0; i < 3; i++) { try { balT.push(run(p, { budgetMode: 'BALANCED', timeBudgetMs: 5000, seed: 900 + i, maxCandidates: 1 }).metrics.totalTimeMs); } catch { balCrash++; } }
    rows.push({
      sections: S, allocations: p.allocations.length, sessionHours: p.allocations.reduce((s, a) => s + a.hoursPerWeek, 0),
      rooms: p.rooms.length, runs: N, feasibleRuns,
      totalMsP50: r2(pct(t, 50)), totalMsP95: r2(pct(t, 95)), compileMsP50: r2(pct(comp, 50)), searchMsP50: r2(pct(feas, 50)),
      backtracksMax: Math.max(...bt), validatorHardMax: hardMax, sessions,
      balancedMsP50: r2(pct(balT, 50)), balancedCrashes: balCrash,
    });
    log('E4', JSON.stringify(rows[rows.length - 1]));
  }
  out.scaling = rows;
}

// ---------------------------------------------------------------- E5 room-tightness sweep (S = 32)
{
  const rows: any[] = [];
  for (const nRooms of [48, 32, 24, 20, 18, 16, 15, 14, 13]) {
    const p = synthetic(32, nRooms / 32, 0.95);
    let res;
    try { res = run(p, { budgetMode: 'FAST', timeBudgetMs: 3000, seed: 777, maxCandidates: 1 }); }
    catch (e: any) { rows.push({ lectureRooms: nRooms, crashed: String(e?.message || e).slice(0, 60) }); log('E5', JSON.stringify(rows[rows.length - 1])); continue; }
    const v = res.bestCandidate ? validate(p, res.bestCandidate.sessions) : null;
    rows.push({
      lectureRooms: nRooms,
      lectureRoomUtilisationPct: r2((32 * 15) / (nRooms * 35) * 100),
      feasible: res.isFeasible, totalMs: res.metrics.totalTimeMs, backtracks: res.metrics.backtracksCount,
      constraintChecks: res.metrics.constraintChecksCount,
      diagnostics: res.infeasibilityDiagnostics?.length || 0,
      validatorHard: v ? v.hardViolationsCount : null,
      status: res.statusMessage.slice(0, 90),
    });
    log('E5', JSON.stringify(rows[rows.length - 1]));
  }
  out.tightness = rows;
}

// ---------------------------------------------------------------- E6 recovery engine on the seeded timetable
{
  const base = run(realProblem, { budgetMode: 'FAST', seed: 1337, maxCandidates: 1 }).bestCandidate!.sessions;
  const lectures = base.filter(s => s.type === 'Lecture');
  let state = 12345;
  const rnd = () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
  const counts: number[] = [], tops: number[] = [], ms: number[] = [], cross: number[] = [];
  for (let k = 0; k < 100; k++) {
    const target = lectures[Math.floor(rnd() * lectures.length)];
    const sessions = base.map(s => (s.id === target.id ? { ...s, status: 'Cancelled' as const } : s));
    const task: MakeupTask = {
      id: `mk-${k}`, cancelledSessionId: target.id, courseId: target.courseId, sectionId: target.sectionId,
      facultyId: target.facultyId, cancelledDay: target.day, cancelledTimeSlot: target.timeSlotId,
      priorityScore: 70, status: 'Pending', createdAt: new Date().toISOString(),
    };
    const t0 = performance.now();
    const opts = findSelfHealingRecoverySlots(task, sessions, realProblem.rooms, realProblem.faculty, realProblem.sections, realProblem.courses);
    ms.push(performance.now() - t0);
    counts.push(opts.length);
    tops.push(opts[0]?.matchScore ?? 0);
    cross.push(opts.filter(o => o.factors.studentAvailability === 98).length);
  }
  out.recovery = {
    cancellations: counts.length,
    withAtLeastOneOption: counts.filter(c => c > 0).length,
    withFiveOptions: counts.filter(c => c === 5).length,
    topScoreRange: [Math.min(...tops), Math.max(...tops)],
    topScoreMean: r2(mean(tops)),
    latencyMsP50: r2(pct(ms, 50)), latencyMsP95: r2(pct(ms, 95)),
  };
  log('E6', out.recovery);
}

// ---------------------------------------------------------------- E7 bcrypt cost
{
  const bcrypt: any = (await import('bcryptjs')).default;
  const t: number[] = [];
  for (let i = 0; i < 5; i++) { const t0 = performance.now(); await bcrypt.hash('Correct-Horse-Battery-9', 12); t.push(performance.now() - t0); }
  const t10: number[] = [];
  for (let i = 0; i < 5; i++) { const t0 = performance.now(); await bcrypt.hash('Correct-Horse-Battery-9', 10); t10.push(performance.now() - t0); }
  out.bcrypt = { cost12MsP50: r2(pct(t, 50)), cost12MsMax: r2(Math.max(...t)), cost10MsP50: r2(pct(t10, 50)) };
  log('E7', out.bcrypt);
}

fs.writeFileSync(process.argv[2] || 'bench_results.json', JSON.stringify(out, null, 2));
log('WROTE', process.argv[2]);
