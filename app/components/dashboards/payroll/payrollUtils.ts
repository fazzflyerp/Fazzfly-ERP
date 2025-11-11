/**
 * Payroll Dashboard Utilities
 * Location: app/components/dashboards/payroll/payrollUtils.ts
 * ✅ Performance Scoring: Late (30) + Leave (30) + OT (40) = 100 points
 */

export interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number;
}

export interface KPIData {
  sum: number;
  avg: number;
  max: number;
  count: number;
}

// ============================================================
// PARSE UTILITIES
// ============================================================

/**
 * Parse numeric value from string or number
 * ✅ Handles: "฿1,000", "$1,000.50", "1000", 1000, "30%"
 */
function parseNumericValue(raw: any): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    // ✅ Remove: commas, currency symbols, %, spaces
    const clean = raw
      .replace(/[฿$€£¥₹,%\s]/g, "")
      .trim();
    
    if (clean === "") return null;
    
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// ============================================================
// PERFORMANCE SCORING FUNCTIONS
// ============================================================

/**
 * Calculate Late Score (0-30 points)
 * ✅ 0 min = 30, 1-30 min = 27, 31-60 min = 22, 61-120 min = 15, >120 min = 0
 */
export function calculateLateScore(lateMinutes: number): number {
  if (lateMinutes === 0) return 30;
  if (lateMinutes <= 30) return 27;
  if (lateMinutes <= 60) return 22;
  if (lateMinutes <= 120) return 15;
  return 0;
}

/**
 * Calculate Leave Score (0-30 points)
 * ✅ 0 days = 30, 1-2 days = 27, 3-4 days = 22, 5 days = 15, >5 days = 0
 */
export function calculateLeaveScore(leaveDays: number): number {
  if (leaveDays === 0) return 30;
  if (leaveDays <= 2) return 27;
  if (leaveDays <= 4) return 22;
  if (leaveDays === 5) return 15;
  return 0;
}

/**
 * Calculate OT Score (0-40 points)
 * ✅ >2400 min = 40, 1200-2400 min = 35, 600-1200 min = 30, 1-600 min = 20, 0 min = 10
 */
export function calculateOTScore(otMinutes: number): number {
  if (otMinutes > 2400) return 40; // >40 hours
  if (otMinutes >= 1200) return 35; // 20-40 hours
  if (otMinutes >= 600) return 30;  // 10-20 hours
  if (otMinutes >= 1) return 20;    // 0-10 hours
  return 10; // 0 hours
}

/**
 * Calculate Total Performance Score
 * ✅ Max 100 points = Late (30) + Leave (30) + OT (40)
 */
export function calculateTotalScore(
  lateMinutes: number,
  leaveDays: number,
  otMinutes: number
): number {
  const lateScore = calculateLateScore(lateMinutes);
  const leaveScore = calculateLeaveScore(leaveDays);
  const otScore = calculateOTScore(otMinutes);
  return lateScore + leaveScore + otScore;
}

/**
 * Get Performance Grade based on score
 * ✅ A: 90-100, B: 80-89, C: 70-79, D: 60-69, F: <60
 */
export function getPerformanceGrade(score: number): {
  grade: string;
  color: string;
  label: string;
} {
  if (score >= 90) {
    return { grade: "A", color: "#10b981", label: "A (90-100)" };
  }
  if (score >= 80) {
    return { grade: "B", color: "#3b82f6", label: "B (80-89)" };
  }
  if (score >= 70) {
    return { grade: "C", color: "#eab308", label: "C (70-79)" };
  }
  if (score >= 60) {
    return { grade: "D", color: "#f59e0b", label: "D (60-69)" };
  }
  return { grade: "F", color: "#ef4444", label: "F (<60)" };
}

// ============================================================
// KPI GENERATION
// ============================================================

/**
 * Generate KPI data from rows
 * ✅ Returns: { salary: {...}, commission: {...}, staff_fees: {...}, etc. }
 */
export function generateKPI(
  rows: any[],
  configFields: ConfigField[]
): { [key: string]: KPIData } {
  console.log("━".repeat(60));
  console.log("📊 [generateKPI] START - Payroll");
  console.log("   Rows:", rows.length);
  console.log("   Config fields:", configFields.length);
  console.log("━".repeat(60));

  const newKpiData: { [key: string]: KPIData } = {};
  
  // ✅ Get all number fields
  const numericFields = configFields.filter((f) => f.type === "number");

  console.log("🔢 Numeric fields found:", numericFields.length);
  numericFields.forEach((f, i) => {
    console.log(`   [${i}] ${f.fieldName} (type: ${f.type}, order: ${f.order})`);
  });

  numericFields.forEach((field) => {
    console.log(`\n📍 Processing field: ${field.fieldName}`);
    
    // Sample first 3 rows
    console.log("   Sample raw values:");
    rows.slice(0, 3).forEach((r, i) => {
      console.log(`      Row ${i}: ${field.fieldName} = "${r[field.fieldName]}" (type: ${typeof r[field.fieldName]})`);
    });

    const values = rows
      .map((r) => parseNumericValue(r[field.fieldName]))
      .filter((v): v is number => typeof v === "number" && !isNaN(v));

    console.log(`   Parsed values: ${values.length}/${rows.length} successful`);
    if (values.length > 0) {
      console.log(`   Sample parsed: [${values.slice(0, 5).join(", ")}...]`);
    }

    if (values.length === 0) {
      console.warn(`   ⚠️ No valid numbers found for ${field.fieldName}!`);
      newKpiData[field.fieldName] = { sum: 0, avg: 0, max: 0, count: 0 };
    } else {
      const sum = values.reduce((acc, curr) => acc + curr, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);
      const count = values.length;

      console.log(`   ✅ Results: sum=${sum.toFixed(2)}, avg=${avg.toFixed(2)}, max=${max}, count=${count}`);

      newKpiData[field.fieldName] = {
        sum: Number(sum.toFixed(2)),
        avg: Number(avg.toFixed(2)),
        max: Number(max.toFixed(2)),
        count,
      };
    }
  });

  console.log("━".repeat(60));
  console.log("✅ [generateKPI] DONE");
  console.log("   Generated KPIs:", Object.keys(newKpiData));
  console.log("━".repeat(60));

  return newKpiData;
}

/**
 * Calculate metric change from previous period
 */
export function getMetricChange(
  fieldName: string,
  currentPeriod: string,
  allData: any[],
  configFields: ConfigField[]
): { change: number | null; icon: string } {
  if (!currentPeriod) {
    return { change: null, icon: "" };
  }

  const periodField = configFields.find((f) => f.type === "period");
  if (!periodField) return { change: null, icon: "" };

  const allUniquePeriods = Array.from(
    new Set(
      allData
        .map((d) => String(d[periodField.fieldName]).trim())
        .filter((p) => p !== "")
    )
  ).sort();

  const currentIndex = allUniquePeriods.indexOf(currentPeriod);
  if (currentIndex <= 0) {
    return { change: null, icon: "" };
  }

  const previousPeriod = allUniquePeriods[currentIndex - 1];

  const currentData = allData.filter(
    (row) => String(row[periodField.fieldName]).trim() === currentPeriod
  );
  const previousData = allData.filter(
    (row) => String(row[periodField.fieldName]).trim() === previousPeriod
  );

  const calculateSum = (data: any[], field: string) => {
    return data
      .map((r) => parseNumericValue(r[field]))
      .filter((v): v is number => typeof v === "number" && !isNaN(v))
      .reduce((acc, curr) => acc + curr, 0);
  };

  const currentSum = calculateSum(currentData, fieldName);
  const previousSum = calculateSum(previousData, fieldName);

  if (previousSum === 0) {
    return { change: null, icon: "" };
  }

  const changePercent = ((currentSum - previousSum) / previousSum) * 100;
  
  // ✅ For Late/Leave: decrease is good (green arrow down)
  // ✅ For OT: increase is good (green arrow up)
  // ✅ For Salary/Commission: increase is good (green arrow up)
  const isPositiveChange = 
    (fieldName === "late" || fieldName === "gff") 
      ? changePercent < 0  // Lower is better
      : changePercent > 0; // Higher is better

  const icon = changePercent > 0 ? "📈" : changePercent < 0 ? "📉" : "➡️";

  return { change: changePercent, icon };
}

// ============================================================
// CHART DATA GENERATION
// ============================================================

/**
 * Generate Performance Distribution (Pie Chart Data)
 * ✅ Groups employees by grade: A, B, C, D, F
 */
export function generatePerformanceDistribution(
  rows: any[],
  configFields: ConfigField[]
): any[] {
  console.log("📊 Generating Performance Distribution...");

  // Group by employee
  const employeeData = groupByEmployee(rows, configFields);

  // Count by grade
  const gradeCounts: Record<string, number> = {
    "A (90-100)": 0,
    "B (80-89)": 0,
    "C (70-79)": 0,
    "D (60-69)": 0,
    "F (<60)": 0,
  };

  employeeData.forEach((emp) => {
    const { label } = getPerformanceGrade(emp.totalScore);
    gradeCounts[label]++;
  });

  const total = employeeData.length;
  const result = Object.entries(gradeCounts).map(([grade, count]) => ({
    grade,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
  }));

  console.log("✅ Performance distribution:", result);
  return result;
}

/**
 * Generate Top Performers (Bar Chart Data)
 * ✅ Top 10 employees by score
 */
export function generateTopPerformers(
  rows: any[],
  configFields: ConfigField[]
): any[] {
  console.log("🏆 Generating Top Performers...");

  const employeeData = groupByEmployee(rows, configFields);

  const sorted = employeeData
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 10);

  const result = sorted.map((emp) => ({
    name: emp.name,
    score: emp.totalScore,
  }));

  console.log("✅ Top performers:", result.length);
  return result;
}

/**
 * Generate OT Leaders (Bar Chart Data)
 * ✅ Top 10 employees by OT hours
 */
export function generateOTLeaders(
  rows: any[],
  configFields: ConfigField[]
): any[] {
  console.log("⏱️ Generating OT Leaders...");

  const employeeData = groupByEmployee(rows, configFields);

  const sorted = employeeData
    .sort((a, b) => b.ot - a.ot)
    .slice(0, 10);

  const result = sorted.map((emp) => ({
    name: emp.name,
    ot: emp.ot,
  }));

  console.log("✅ OT leaders:", result.length);
  return result;
}

/**
 * Generate Attendance Data (Stacked Bar Chart)
 * ✅ Top 10 employees with attendance issues (late + leave)
 */
export function generateAttendanceData(
  rows: any[],
  configFields: ConfigField[]
): any[] {
  console.log("📊 Generating Attendance Data...");

  const employeeData = groupByEmployee(rows, configFields);

  // Sort by total attendance issues (late + leave)
  const sorted = employeeData
    .map((emp) => ({
      ...emp,
      issueScore: emp.late + emp.leave * 60, // Convert leave days to minutes for comparison
    }))
    .sort((a, b) => b.issueScore - a.issueScore)
    .slice(0, 10);

  const result = sorted.map((emp) => ({
    name: emp.name,
    late: emp.late,
    leave: emp.leave,
  }));

  console.log("✅ Attendance data:", result.length);
  return result;
}

/**
 * Generate Performance Table
 * ✅ All employees with full scoring breakdown
 */
export function generatePerformanceTable(
  rows: any[],
  configFields: ConfigField[]
): any[] {
  console.log("📋 Generating Performance Table...");

  const employeeData = groupByEmployee(rows, configFields);

  const sorted = employeeData.sort((a, b) => b.totalScore - a.totalScore);

  const result = sorted.map((emp, index) => {
    const { grade, color, label } = getPerformanceGrade(emp.totalScore);
    return {
      rank: index + 1,
      name: emp.name,
      salary: emp.salary,
      late: emp.late,
      leave: emp.leave,
      ot: emp.ot,
      advPayments: emp.advPayments,
      lateScore: emp.lateScore,
      leaveScore: emp.leaveScore,
      otScore: emp.otScore,
      totalScore: emp.totalScore,
      grade: label,
      gradeColor: color,
    };
  });

  console.log("✅ Performance table:", result.length, "employees");
  return result;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Group rows by employee and calculate aggregates
 */
function groupByEmployee(rows: any[], configFields: ConfigField[]): any[] {
  const nameField = configFields.find(
    (f) => f.fieldName === "employees_name" || f.type === "text"
  );

  if (!nameField) {
    console.error("❌ Cannot find employee name field!");
    return [];
  }

  const grouped: Record<string, any> = {};

  rows.forEach((row) => {
    const name = String(row[nameField.fieldName] || "").trim();
    if (!name) return;

    if (!grouped[name]) {
      grouped[name] = {
        name,
        salary: 0,
        commission: 0,
        staff_fees: 0,
        late: 0,
        leave: 0,
        ot: 0,
        advPayments: 0,
        count: 0,
      };
    }

    grouped[name].salary += parseNumericValue(row["salary"]) || 0;
    grouped[name].commission += parseNumericValue(row["commission"]) || 0;
    grouped[name].staff_fees += parseNumericValue(row["staff_fees"]) || 0;
    grouped[name].late += parseNumericValue(row["late"]) || 0;
    grouped[name].leave += parseNumericValue(row["gff"]) || 0;
    grouped[name].ot += parseNumericValue(row["ot"]) || 0;
    grouped[name].advPayments += parseNumericValue(row["adv_payments"]) || 0;
    grouped[name].count += 1;
  });

  // Calculate scores for each employee
  return Object.values(grouped).map((emp) => {
    const lateScore = calculateLateScore(emp.late);
    const leaveScore = calculateLeaveScore(emp.leave);
    const otScore = calculateOTScore(emp.ot);
    const totalScore = lateScore + leaveScore + otScore;

    return {
      ...emp,
      lateScore,
      leaveScore,
      otScore,
      totalScore,
    };
  });
}

/**
 * Get unique periods from data
 */
export function getPeriodOptions(
  data: any[],
  configFields: ConfigField[]
): string[] {
  let periodField = configFields.find((f) => f.type === "period");
  
  if (!periodField) {
    console.warn("⚠️ Period field not found by type, using fallback");
    periodField = configFields.find((f) => 
      f.fieldName === "period" ||
      f.fieldName === "Period" ||
      f.fieldName === "Month" ||
      f.fieldName === "เดือน"
    );
  }
  
  if (!periodField) {
    console.error("❌ Cannot find period field!");
    console.log("Available fields:", configFields.map(f => f.fieldName));
    return [];
  }

  return Array.from(
    new Set(
      data
        .map((d) => d[periodField.fieldName])
        .filter(
          (p) =>
            p !== null &&
            p !== undefined &&
            String(p).trim() !== ""
        )
        .map(String)
    )
  ).sort();
}