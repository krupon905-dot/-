import { DEFAULT_SHEET2_TEACHERS, Sheet2Teacher } from '../data/defaultTeachers';

export interface UnsubmittedTeacherInfo {
  no: string;
  fullName: string;
  position: string;
  department: string;
  normalizedDept: string;
  hasSubmitted: boolean;
  submittedCount: number;
  submittedSubjects: string[];
}

export interface DepartmentReport {
  department: string;
  totalTeachers: number;
  submittedCount: number;
  unsubmittedCount: number;
  completionRate: number;
  unsubmittedTeachers: Sheet2Teacher[];
  submittedTeachers: Sheet2Teacher[];
}

/**
 * Strips common Thai honorific prefixes and titles
 */
export function stripPrefix(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/^(นาย|นางสาว|นาง|ว่าที่\s*ร\.ต\.\s*หญิง|ว่าที่\s*ร\.ต\.|ว่าที่ร้อยตรี|ดร\.|ครู|อ\.)\s*/gi, '')
    .trim();
}

/**
 * Normalizes Thai characters, cleans typos, Unicode composition, and keyboard slips
 */
export function normalizeThaiChars(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFC')
    // Fix keyboard typo: ื (สระอือ) mistyped for ์ (ไม้ทัณฑฆาต/การันต์) after Thai consonant
    .replace(/([ก-ฮ])ื(\s|$)/g, '$1์$2')
    // Fix tone mark order with Sara Am (e.g. คำ้ -> ค้ำ)
    .replace(/\u0e33([\u0e48-\u0e4c])/g, '$1\u0e33')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero width spaces
    .trim();
}

/**
 * Calculates Levenshtein edit distance between two strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Robust fuzzy matching for Thai full names:
 * - Handles spacing and multiple whitespace
 * - Handles honorifics/prefixes (นาย, นาง, นางสาว, ว่าที่ ร.ต., ครู, etc.)
 * - Handles small typos or spelling variants (e.g. ลักษณ์ vs ลักษ์, ขันทะพล vs ขันทะผล, พรหหมมา vs พรหมมา)
 * - Compares first name and last name intelligently
 */
export function isNamesFuzzyMatch(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;

  const rawCleanA = stripPrefix(nameA);
  const rawCleanB = stripPrefix(nameB);

  // 1. Exact raw match
  if (rawCleanA === rawCleanB) return true;

  const cleanA = normalizeThaiChars(rawCleanA);
  const cleanB = normalizeThaiChars(rawCleanB);
  if (cleanA === cleanB) return true;

  // 2. Exact match ignoring all whitespace
  const noSpaceA = cleanA.replace(/\s+/g, '');
  const noSpaceB = cleanB.replace(/\s+/g, '');
  if (noSpaceA === noSpaceB) return true;

  // 3. Substring containment if both are long enough
  if (noSpaceA.length >= 6 && noSpaceB.length >= 6) {
    if (noSpaceA.includes(noSpaceB) || noSpaceB.includes(noSpaceA)) return true;
  }

  // 4. Split into first name and last name
  const partsA = cleanA.split(/\s+/).filter(Boolean);
  const partsB = cleanB.split(/\s+/).filter(Boolean);

  const fnA = partsA[0] || '';
  const fnB = partsB[0] || '';
  const lnA = partsA.slice(1).join('') || '';
  const lnB = partsB.slice(1).join('') || '';

  // Case A: First names match exactly or very closely (e.g. วาสนา == วาสนา)
  if (fnA && fnB && (fnA === fnB || levenshteinDistance(fnA, fnB) <= 1)) {
    // If one omitted the last name
    if (!lnA || !lnB) return true;

    // Last names match or contain
    if (lnA === lnB) return true;
    if (lnA.includes(lnB) || lnB.includes(lnA)) return true;

    // Last names share significant prefix (e.g. จันทะวิ... in จันทะวิลักษณ์ vs จันทะวิลักษ์)
    if (lnA.length >= 4 && lnB.length >= 4 && lnA.slice(0, 4) === lnB.slice(0, 4)) return true;

    // Small typo in last name (e.g. distance <= 2)
    if (levenshteinDistance(lnA, lnB) <= 2) return true;
  }

  // Case B: Last names match exactly, and first names are very close
  if (lnA && lnB && lnA === lnB && fnA && fnB && levenshteinDistance(fnA, fnB) <= 2) {
    return true;
  }

  // Case C: Overall small typo across full string without spaces
  if (Math.abs(noSpaceA.length - noSpaceB.length) <= 2 && levenshteinDistance(noSpaceA, noSpaceB) <= 2) {
    return true;
  }

  return false;
}

/**
 * Normalizes a Thai full name by removing common honorific prefixes and all internal whitespaces
 */
export function normalizeThaiName(name: string): string {
  if (!name) return '';
  return normalizeThaiChars(stripPrefix(name)).replace(/\s+/g, '');
}

/**
 * Normalizes learning area / department names to standard names
 */
export function normalizeDepartment(dept: string): string {
  if (!dept) return 'ไม่ระบุกลุ่มสาระ';
  const d = dept.trim();
  if (d.includes('ส้งคม') || d.includes('สังคม')) return 'สังคมศึกษา ศาสนาและวัฒนธรรม';
  if (d.includes('พลศึกษา') || d.includes('สุขศึกษา')) return 'สุขศึกษาและพลศึกษา';
  if (d.includes('กิจกรรมพัฒนาผู้เรียน') || d.includes('แนะแนว')) return 'กิจกรรมพัฒนาผู้เรียน / แนะแนว';
  if (d.includes('วิทยาศา') || d.includes('เทคโนโลยี')) return 'วิทยาศาสตร์และเทคโนโลยี';
  if (d.includes('คณิต')) return 'คณิตศาสตร์';
  if (d.includes('ภาษาไทย')) return 'ภาษาไทย';
  if (d.includes('ต่างประเทศ')) return 'ภาษาต่างประเทศ';
  if (d.includes('การงาน')) return 'การงานอาชีพ';
  if (d.includes('ศิลปะ')) return 'ศิลปะ';
  return d;
}

/**
 * Fetches the latest teacher list from Sheet2 of the configured Google Spreadsheet.
 * Uses JSONP / Google Visualization API with automatic fallback to pre-bundled roster.
 */
export async function fetchSheet2Teachers(sheetId: string): Promise<Sheet2Teacher[]> {
  try {
    // Attempt 1: Fetch via Google Visualization API CSV
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Sheet2`;
    const res = await fetch(csvUrl, { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.text();
      const parsed = parseSheet2CSV(text);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Direct Sheet2 fetch not available, trying JSONP...', err);
  }

  try {
    // Attempt 2: JSONP callback via Google Visualization API
    const jsonpData = await fetchViaJSONP(sheetId);
    if (jsonpData && jsonpData.length > 0) {
      return jsonpData;
    }
  } catch (err) {
    console.warn('JSONP Sheet2 fetch not available, using bundled roster:', err);
  }

  // Fallback: bundled default teachers roster
  return DEFAULT_SHEET2_TEACHERS;
}

function parseSheet2CSV(csvText: string): Sheet2Teacher[] {
  const lines = csvText.split('\n');
  const teachers: Sheet2Teacher[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row: string[] = [];
    let inQuotes = false;
    let cur = '';

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    row.push(cur.trim());

    if (row.length >= 3) {
      const no = row[0] || String(i);
      const fullName = (row[3] || `${row[1]} ${row[2]}`).replace(/^"|"$/g, '').trim();
      const position = (row[4] || 'ครู').replace(/^"|"$/g, '').trim();
      const department = (row[5] || 'ไม่ระบุ').replace(/^"|"$/g, '').trim();

      if (fullName) {
        teachers.push({
          no,
          fullName,
          position,
          department
        });
      }
    }
  }

  return teachers;
}

function fetchViaJSONP(sheetId: string): Promise<Sheet2Teacher[]> {
  return new Promise((resolve, reject) => {
    const callbackName = 'sheet2_cb_' + Math.random().toString(36).substring(2, 9);
    const script = document.createElement('script');
    
    // Timeout safeguard
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 6000);

    function cleanup() {
      clearTimeout(timeout);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete (window as any)[callbackName];
    }

    (window as any)[callbackName] = (data: any) => {
      cleanup();
      try {
        const rows = data?.table?.rows;
        if (!rows || !Array.isArray(rows)) {
          resolve([]);
          return;
        }

        const teachers: Sheet2Teacher[] = [];
        rows.forEach((r: any, idx: number) => {
          const c = r.c;
          if (!c) return;
          const no = c[0]?.v ? String(c[0].v) : String(idx + 1);
          const fullName = c[3]?.v || (c[1]?.v ? `${c[1]?.v} ${c[2]?.v || ''}`.trim() : '');
          const position = c[4]?.v || 'ครู';
          const department = c[5]?.v || 'ไม่ระบุ';

          if (fullName) {
            teachers.push({
              no,
              fullName: String(fullName).trim(),
              position: String(position).trim(),
              department: String(department).trim()
            });
          }
        });

        resolve(teachers);
      } catch (e) {
        reject(e);
      }
    };

    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=Sheet2`;
    script.onerror = () => {
      cleanup();
      reject(new Error('Failed to load JSONP script for Sheet2'));
    };

    document.body.appendChild(script);
  });
}

/**
 * Checks whether a teacher from Sheet2 has submitted lesson plans in the specified period
 */
export function isTeacherSubmitted(
  teacher: Sheet2Teacher,
  plans: Array<{ userName?: string; year?: string; semester?: string; subjectName?: string; subjectId?: string }>,
  targetYear: string = 'ทั้งหมด',
  targetSemester: string = 'ทั้งหมด'
): { hasSubmitted: boolean; matchedPlans: any[] } {
  const matched = plans.filter(p => {
    if (targetYear !== 'ทั้งหมด' && String(p.year) !== String(targetYear)) return false;
    if (targetSemester !== 'ทั้งหมด' && String(p.semester) !== String(targetSemester)) return false;

    if (!p.userName) return false;
    return isNamesFuzzyMatch(teacher.fullName, p.userName);
  });

  return {
    hasSubmitted: matched.length > 0,
    matchedPlans: matched
  };
}
