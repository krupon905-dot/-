import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserX, 
  UserCheck, 
  AlertCircle, 
  Copy, 
  Printer, 
  RefreshCw, 
  Search, 
  Layers, 
  CheckCircle2, 
  Share2, 
  Clock,
  Sparkles,
  School
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Sheet2Teacher } from '../data/defaultTeachers';
import { normalizeDepartment, normalizeThaiName, isTeacherSubmitted, isNamesFuzzyMatch } from '../services/sheet2Service';
import { CONFIG } from '../constants';

interface LessonPlanSummary {
  id: string;
  userName: string;
  department: string;
  year: string;
  semester: string;
  subjectId?: string;
  subjectName?: string;
  status: string;
}

interface Props {
  teachers: Sheet2Teacher[];
  plans: LessonPlanSummary[];
  yearFilter: string;
  termFilter: string;
  onYearChange?: (y: string) => void;
  onTermChange?: (t: string) => void;
  onRefreshTeachers?: () => void;
  isRefreshing?: boolean;
}

export default function UnsubmittedTeachersReport({
  teachers,
  plans,
  yearFilter,
  termFilter,
  onYearChange,
  onTermChange,
  onRefreshTeachers,
  isRefreshing = false
}: Props) {
  const [selectedDept, setSelectedDept] = useState<string>('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'byDept' | 'all'>('byDept');
  const [copiedDept, setCopiedDept] = useState<string | null>(null);

  // Group all teachers by normalized department
  const departmentList = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach(t => set.add(normalizeDepartment(t.department)));
    return Array.from(set).sort((a, b) => {
      const idxA = CONFIG.DEPARTMENTS.indexOf(a);
      const idxB = CONFIG.DEPARTMENTS.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, 'th');
    });
  }, [teachers]);

  // Compute submission status for each teacher based on year & term filter
  const processedTeachers = useMemo(() => {
    return teachers.map(t => {
      const normDept = normalizeDepartment(t.department);
      const check = isTeacherSubmitted(t, plans, yearFilter, termFilter);
      
      // Also check if they ever submitted in any year/term
      const everSubmitted = plans.some(p => p.userName && isNamesFuzzyMatch(t.fullName, p.userName));

      return {
        ...t,
        normalizedDept: normDept,
        hasSubmitted: check.hasSubmitted,
        matchedPlans: check.matchedPlans,
        everSubmitted
      };
    });
  }, [teachers, plans, yearFilter, termFilter]);

  // Overall statistics
  const stats = useMemo(() => {
    const total = processedTeachers.length;
    const submitted = processedTeachers.filter(t => t.hasSubmitted).length;
    const unsubmitted = total - submitted;
    const rate = total > 0 ? ((submitted / total) * 100).toFixed(1) : '0';
    return { total, submitted, unsubmitted, rate };
  }, [processedTeachers]);

  // Teachers who haven't submitted (filtered by search and selected department)
  const unsubmittedList = useMemo(() => {
    return processedTeachers
      .filter(t => !t.hasSubmitted)
      .filter(t => {
        if (selectedDept !== 'ทั้งหมด' && t.normalizedDept !== selectedDept) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchName = t.fullName.toLowerCase().includes(q);
          const matchDept = t.department.toLowerCase().includes(q) || t.normalizedDept.toLowerCase().includes(q);
          const matchPos = (t.position || '').toLowerCase().includes(q);
          return matchName || matchDept || matchPos;
        }
        return true;
      });
  }, [processedTeachers, selectedDept, searchQuery]);

  // Breakdown by department
  const departmentStats = useMemo(() => {
    return departmentList.map(dept => {
      const deptTeachers = processedTeachers.filter(t => t.normalizedDept === dept);
      const total = deptTeachers.length;
      const submitted = deptTeachers.filter(t => t.hasSubmitted);
      const unsubmitted = deptTeachers.filter(t => !t.hasSubmitted);
      const rate = total > 0 ? Math.round((submitted.length / total) * 100) : 0;

      return {
        department: dept,
        total,
        submittedCount: submitted.length,
        unsubmittedCount: unsubmitted.length,
        rate,
        unsubmittedTeachers: unsubmitted,
        submittedTeachers: submitted
      };
    });
  }, [departmentList, processedTeachers]);

  // Copy names to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `คัดลอกรายชื่อ${label}เรียบร้อยแล้ว`,
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
    });
  };

  const handleCopyAllUnsubmitted = () => {
    const periodText = yearFilter === 'ทั้งหมด' 
      ? 'ทุกปีการศึกษา' 
      : `ปีการศึกษา ${yearFilter} ${termFilter === 'ทั้งหมด' ? 'ทุกภาคเรียน' : `ภาคเรียนที่ ${termFilter}`}`;
    
    let text = `📢 รายชื่อครูที่ยังไม่ส่งแผนการจัดการเรียนรู้\nโรงเรียนท่าบ่อ (${periodText})\nยอดรวม: ยังไม่ส่ง ${stats.unsubmitted} คน จากทั้งหมด ${stats.total} คน\n---------------------------------\n`;
    
    departmentStats.forEach(d => {
      if (d.unsubmittedCount > 0) {
        text += `\n📌 กลุ่มสาระฯ ${d.department} (ยังไม่ส่ง ${d.unsubmittedCount}/${d.total} คน):\n`;
        d.unsubmittedTeachers.forEach((t, i) => {
          text += `  ${i + 1}. ${t.fullName} (${t.position || 'ครู'})\n`;
        });
      }
    });

    copyToClipboard(text, 'ทั้งหมด');
  };

  const handleCopyDeptUnsubmitted = (deptStat: (typeof departmentStats)[0]) => {
    const periodText = yearFilter === 'ทั้งหมด' 
      ? 'ทุกปีการศึกษา' 
      : `ปีการศึกษา ${yearFilter} ${termFilter === 'ทั้งหมด' ? 'ทุกภาคเรียน' : `ภาคเรียนที่ ${termFilter}`}`;

    let text = `📌 รายชื่อครูที่ยังไม่ส่งแผนการจัดการเรียนรู้\nกลุ่มสาระฯ ${deptStat.department} (${periodText})\nยังไม่ส่ง ${deptStat.unsubmittedCount} คน จากทั้งหมด ${deptStat.total} คน\n---------------------------------\n`;
    deptStat.unsubmittedTeachers.forEach((t, i) => {
      text += `${i + 1}. ${t.fullName} (${t.position || 'ครู'})\n`;
    });

    setCopiedDept(deptStat.department);
    setTimeout(() => setCopiedDept(null), 2000);
    copyToClipboard(text, deptStat.department);
  };

  // Print official unsubmitted report
  const printUnsubmittedReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isCurrent = yearFilter === CONFIG.CURRENT_YEAR && termFilter === CONFIG.CURRENT_SEMESTER;
    const periodText = yearFilter === 'ทั้งหมด' 
      ? 'ทุกปีการศึกษา / ทุกภาคเรียน' 
      : `ปีการศึกษา ${yearFilter} ${termFilter === 'ทั้งหมด' ? 'ทุกภาคเรียน' : `ภาคเรียนที่ ${termFilter}`}`;

    const dateFormatted = new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>รายงานรายชื่อครูที่ยังไม่ส่งแผนการสอน - โรงเรียนท่าบ่อ</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');
            body { font-family: 'Sarabun', sans-serif; padding: 30px; color: #111; line-height: 1.5; font-size: 13pt; }
            .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #333; padding-bottom: 15px; }
            .logo { width: 85px; margin-bottom: 10px; }
            h2 { margin: 0; font-size: 18pt; font-weight: 700; }
            h3 { margin: 5px 0 0 0; font-size: 14pt; font-weight: 600; color: #333; }
            p { margin: 4px 0; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11pt; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; }
            th, td { border: 1px solid #777; padding: 8px 10px; font-size: 11pt; }
            th { background-color: #f2f2f2; font-weight: 700; text-align: center; }
            .dept-header { background-color: #fdf2e9; font-weight: 700; padding: 8px 12px; border: 1px solid #777; }
            .text-center { text-align: center; }
            .badge-warn { color: #c0392b; font-weight: bold; }
            .badge-ok { color: #27ae60; font-weight: bold; }
            .footer-sign { margin-top: 50px; display: flex; justify-content: space-around; text-align: center; page-break-inside: avoid; }
            .sign-box { width: 260px; border-top: 1px dotted #333; padding-top: 8px; margin-top: 60px; }
            @media print {
              body { padding: 10mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="https://img1.pic.in.th/images/logotbs_02-2-2.png" class="logo" />
            <h2>รายงานการตรวจสอบการส่งแผนการจัดการเรียนรู้</h2>
            <h3>โรงเรียนท่าบ่อ สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาหนองคาย</h3>
            <p><strong>ข้อมูลประจำ:</strong> ${periodText}</p>
          </div>

          <div class="meta">
            <div><strong>ฐานข้อมูลครู:</strong> ทั้งหมด ${stats.total} คน | <strong>ส่งแผนแล้ว:</strong> ${stats.submitted} คน | <strong style="color:#c0392b;">ยังไม่ส่งแผน:</strong> ${stats.unsubmitted} คน</div>
            <div><strong>วันที่พิมพ์:</strong> ${dateFormatted}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">ที่</th>
                <th>ชื่อ-สกุล ครูผู้สอน</th>
                <th style="width: 140px;">ตำแหน่ง</th>
                <th style="width: 200px;">กลุ่มสาระการเรียนรู้</th>
                <th style="width: 120px;">สถานะการส่ง</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              ${unsubmittedList.length === 0 ? `
                <tr>
                  <td colspan="6" class="text-center" style="padding: 20px; color: #27ae60;">
                    <strong>ยอดเยี่ยมมาก! ครูทุกคนส่งแผนการสอนครบถ้วนแล้ว</strong>
                  </td>
                </tr>
              ` : unsubmittedList.map((t, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td><strong>${t.fullName}</strong></td>
                  <td>${t.position || 'ครู'}</td>
                  <td>${t.normalizedDept}</td>
                  <td class="text-center badge-warn">ยังไม่ส่งแผน</td>
                  <td style="font-size: 10pt; color: #666;">
                    ${t.everSubmitted ? 'เคยส่งในภาคเรียนอื่น' : 'ยังไม่มีประวัติการส่ง'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer-sign">
            <div>
              <p>ลงชื่อ......................................................</p>
              <div class="sign-box">
                <p>(..........................................................)</p>
                <p>หัวหน้างานนิเทศและวิชาการ</p>
              </div>
            </div>
            <div>
              <p>ลงชื่อ......................................................</p>
              <div class="sign-box">
                <p>(..........................................................)</p>
                <p>ผู้อำนวยการโรงเรียนท่าบ่อ</p>
              </div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 bg-gradient-to-b from-amber-50/70 to-white rounded-[36px] border-4 border-amber-200 p-6 md:p-10 shadow-xl">
      {/* Header and Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b-2 border-amber-200">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="bg-amber-500 text-white p-2.5 rounded-2xl shadow-md">
              <UserX size={32} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-2xl md:text-3xl font-black text-amber-950 flex items-center gap-2">
                  ตรวจเช็ครายชื่อครูที่ยังไม่ส่งแผนการจัดการเรียนรู้
                </h3>
                {yearFilter === CONFIG.CURRENT_YEAR && termFilter === CONFIG.CURRENT_SEMESTER ? (
                  <span className="bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse"></span>
                    ภาคเรียนที่ {CONFIG.CURRENT_SEMESTER}/{CONFIG.CURRENT_YEAR}
                  </span>
                ) : (
                  <span className="bg-amber-200 text-amber-950 text-xs font-black px-3 py-1 rounded-full shadow-sm">
                    {yearFilter === 'ทั้งหมด' ? 'ทุกปีการศึกษา' : `ปี ${yearFilter}`} / {termFilter === 'ทั้งหมด' ? 'ทุกภาคเรียน' : `เทอม ${termFilter}`}
                  </span>
                )}
              </div>
              <p className="text-sm md:text-base font-bold text-amber-700/80 mt-1">
                รายงานประจำ <span className="font-black text-amber-950">ปีการศึกษา {yearFilter} ภาคเรียนที่ {termFilter}</span> • ตรวจเช็ครายชื่อแต่ละกลุ่มสาระการเรียนรู้จาก Sheet2 ({teachers.length} ท่าน)
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {onRefreshTeachers && (
            <button
              onClick={onRefreshTeachers}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border-2 border-amber-300 text-amber-900 font-black text-sm hover:bg-amber-100 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              title="ดึงข้อมูลรายชื่อครูจาก Sheet2 ใหม่ล่าสุด"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin text-amber-600' : 'text-amber-600'} />
              <span>{isRefreshing ? 'กำลังอัปเดต Sheet2...' : 'รีเฟรช Sheet2'}</span>
            </button>
          )}

          <button
            onClick={handleCopyAllUnsubmitted}
            disabled={stats.unsubmitted === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
            title="คัดลอกรายชื่อครูที่ยังไม่ส่งแผนทั้งหมดไปวางในไลน์"
          >
            <Copy size={18} />
            <span>คัดลอกรายชื่อ ({stats.unsubmitted})</span>
          </button>

          <button
            onClick={printUnsubmittedReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-900 hover:bg-black text-white font-black text-sm transition-all shadow-md active:scale-95"
            title="พิมพ์เอกสารรายงานสรุปรายชื่อผู้ยังไม่ส่งแผน"
          >
            <Printer size={18} />
            <span>พิมพ์รายงาน</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800">
            <School size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-amber-900/60 uppercase">ครูทั้งหมด (Sheet2)</p>
            <p className="text-3xl font-black text-amber-950">{stats.total} <span className="text-sm font-bold text-amber-800">คน</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border-2 border-emerald-200 shadow-md flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <UserCheck size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-emerald-800/70 uppercase">ส่งแผนการสอนแล้ว</p>
            <p className="text-3xl font-black text-emerald-700">{stats.submitted} <span className="text-sm font-bold text-emerald-700">คน</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border-2 border-rose-200 shadow-md flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-700">
            <UserX size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-rose-800/70 uppercase">ยังไม่ส่งแผน</p>
            <p className="text-3xl font-black text-rose-700">{stats.unsubmitted} <span className="text-sm font-bold text-rose-700">คน</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800">
            <Sparkles size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-amber-900/60 uppercase">คิดเป็นร้อยละที่ส่ง</p>
            <p className="text-3xl font-black text-amber-950">{stats.rate}%</p>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-md flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Academic Year and Term Selector */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-2xl border border-amber-200">
            <span className="text-xs font-black text-amber-900">ปีการศึกษา:</span>
            <select
              value={yearFilter}
              onChange={(e) => onYearChange && onYearChange(e.target.value)}
              className="bg-transparent font-black text-sm text-amber-950 outline-none cursor-pointer"
            >
              <option value="ทั้งหมด">ทุกปีการศึกษา</option>
              {CONFIG.YEARS.map(y => (
                <option key={y} value={y}>
                  ปี {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-2xl border border-amber-200">
            <span className="text-xs font-black text-amber-900">ภาคเรียน:</span>
            <select
              value={termFilter}
              onChange={(e) => onTermChange && onTermChange(e.target.value)}
              className="bg-transparent font-black text-sm text-amber-950 outline-none cursor-pointer"
            >
              <option value="ทั้งหมด">ทุกภาคเรียน</option>
              {CONFIG.SEMESTERS.map(s => (
                <option key={s} value={s}>
                  ภาคเรียนที่ {s}
                </option>
              ))}
            </select>
          </div>

          {(yearFilter !== CONFIG.CURRENT_YEAR || termFilter !== CONFIG.CURRENT_SEMESTER) && (
            <button
              onClick={() => {
                onYearChange && onYearChange(CONFIG.CURRENT_YEAR);
                onTermChange && onTermChange(CONFIG.CURRENT_SEMESTER);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs transition-all shadow-sm active:scale-95"
              title={`สลับกลับสู่ปี ${CONFIG.CURRENT_YEAR} ภาคเรียนที่ ${CONFIG.CURRENT_SEMESTER}`}
            >
              <Clock size={14} />
              <span>ดูเทอม {CONFIG.CURRENT_SEMESTER}/{CONFIG.CURRENT_YEAR}</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-2xl border border-amber-200">
            <span className="text-xs font-black text-amber-900">กลุ่มสาระ:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-transparent font-black text-sm text-amber-950 outline-none cursor-pointer max-w-[180px] truncate"
            >
              <option value="ทั้งหมด">ทุกกลุ่มสาระการเรียนรู้</option>
              {departmentList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Toggle & Search */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Mode Switcher */}
          <div className="bg-amber-100 p-1 rounded-2xl flex items-center border border-amber-300">
            <button
              onClick={() => setViewMode('byDept')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                viewMode === 'byDept'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-950 hover:bg-amber-200/60'
              }`}
            >
              🏢 แยกรายกลุ่มสาระ
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                viewMode === 'all'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-950 hover:bg-amber-200/60'
              }`}
            >
              🌟 รายชื่อทั้งหมด ({stats.unsubmitted})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[200px] w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={16} />
            <input
              type="text"
              placeholder="ค้นหาชื่อครู..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs font-bold text-amber-950 outline-none focus:border-amber-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Content Section: View Mode 1 - By Department */}
      {viewMode === 'byDept' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departmentStats
              .filter(d => selectedDept === 'ทั้งหมด' || d.department === selectedDept)
              .map(deptStat => {
                const isComplete = deptStat.unsubmittedCount === 0;
                
                // If search query is entered, also filter teachers inside department card
                const filteredUnsubmitted = deptStat.unsubmittedTeachers.filter(t => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.trim().toLowerCase();
                  return t.fullName.toLowerCase().includes(q) || (t.position || '').toLowerCase().includes(q);
                });

                return (
                  <div 
                    key={deptStat.department}
                    className={`rounded-3xl border-3 transition-all duration-300 p-6 flex flex-col justify-between shadow-lg ${
                      isComplete 
                        ? 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-500' 
                        : 'bg-white border-amber-200 hover:border-amber-400 hover:shadow-xl'
                    }`}
                  >
                    <div>
                      {/* Dept Header */}
                      <div className="flex items-start justify-between gap-3 pb-4 border-b border-amber-100">
                        <div>
                          <span className="text-[11px] font-black uppercase tracking-wider text-amber-700/70 block">
                            กลุ่มสาระการเรียนรู้
                          </span>
                          <h4 className="text-lg md:text-xl font-black text-amber-950 leading-tight">
                            {deptStat.department}
                          </h4>
                        </div>
                        <span className={`px-3 py-1 rounded-xl text-xs font-black shadow-sm ${
                          isComplete 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {isComplete ? 'ครบ 100%' : `ค้างส่ง ${deptStat.unsubmittedCount} คน`}
                        </span>
                      </div>

                      {/* Progress Bar & Counts */}
                      <div className="py-4 space-y-2">
                        <div className="flex justify-between items-center text-xs font-black text-amber-900">
                          <span>ส่งแล้ว {deptStat.submittedCount} / {deptStat.total} คน</span>
                          <span className="text-amber-700">{deptStat.rate}%</span>
                        </div>
                        <div className="w-full bg-amber-100 rounded-full h-3 overflow-hidden p-0.5 border border-amber-200">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-rose-500'
                            }`}
                            style={{ width: `${deptStat.rate}%` }}
                          />
                        </div>
                      </div>

                      {/* Unsubmitted Teachers List */}
                      <div className="pt-2">
                        {isComplete ? (
                          <div className="bg-emerald-100/60 p-4 rounded-2xl border border-emerald-200 text-center flex flex-col items-center gap-1.5 py-6">
                            <CheckCircle2 size={32} className="text-emerald-600" />
                            <p className="text-sm font-black text-emerald-900">ส่งแผนครบถ้วนทุกคนแล้ว!</p>
                            <p className="text-xs text-emerald-700">ไม่มีครูค้างส่งในกลุ่มสาระนี้</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-rose-900 flex items-center gap-1">
                                <AlertCircle size={14} className="text-rose-600" />
                                รายชื่อครูที่ยังไม่ส่ง ({deptStat.unsubmittedCount} คน):
                              </span>
                              <button
                                onClick={() => handleCopyDeptUnsubmitted(deptStat)}
                                className="text-[11px] font-black text-amber-700 hover:text-amber-900 flex items-center gap-1 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-xl transition-all"
                                title="คัดลอกรายชื่อกลุ่มนี้"
                              >
                                <Copy size={12} />
                                {copiedDept === deptStat.department ? 'คัดลอกแล้ว!' : 'คัดลอก'}
                              </button>
                            </div>

                            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                              {filteredUnsubmitted.map((t, idx) => (
                                <div 
                                  key={t.no || idx}
                                  className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/80 text-xs transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-black text-[10px] flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </span>
                                    <span className="font-black text-amber-950">{t.fullName}</span>
                                  </div>
                                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-lg border border-amber-200 font-bold text-amber-800">
                                    {t.position || 'ครู'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Indicator */}
                    <div className="pt-4 mt-4 border-t border-amber-100 flex items-center justify-between text-[11px] text-amber-900/60 font-bold">
                      <span>ฐานข้อมูล Sheet2</span>
                      <span>รวมครู {deptStat.total} คน</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Content Section: View Mode 2 - All Unsubmitted Teachers Table */}
      {viewMode === 'all' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-sm font-black text-amber-950">
              พบครูที่ยังไม่ส่งแผนการสอน {unsubmittedList.length} ท่าน (จากทั้งหมด {stats.total} ท่าน)
            </span>
            <span className="text-xs text-amber-800 font-bold">
              ปีการศึกษา: {yearFilter === 'ทั้งหมด' ? 'ทุกปี' : yearFilter} | เทอม: {termFilter === 'ทั้งหมด' ? 'ทุกเทอม' : termFilter}
            </span>
          </div>

          <div className="bg-white rounded-3xl border-2 border-amber-200 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-amber-100/80 border-b-2 border-amber-200 text-amber-950 text-xs md:text-sm font-black">
                    <th className="p-4 text-center w-16">ลำดับ</th>
                    <th className="p-4">ชื่อ - นามสกุล ครูผู้สอน</th>
                    <th className="p-4">ตำแหน่ง</th>
                    <th className="p-4">กลุ่มสาระการเรียนรู้</th>
                    <th className="p-4 text-center">สถานะ</th>
                    <th className="p-4 text-center">ประวัติเดิม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-xs md:text-sm">
                  {unsubmittedList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <CheckCircle2 size={48} className="text-emerald-500 animate-bounce" />
                          <p className="text-xl font-black text-emerald-800">ยอดเยี่ยมมาก! ไม่มีรายชื่อค้างส่งแผน</p>
                          <p className="text-xs text-amber-700">ครูทุกคนส่งแผนการสอนครบถ้วนเรียบร้อยแล้วในเงื่อนไขนี้</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    unsubmittedList.map((teacher, index) => (
                      <tr 
                        key={teacher.no || index} 
                        className="hover:bg-amber-50/60 transition-colors"
                      >
                        <td className="p-4 text-center font-black text-amber-800/80">
                          {index + 1}
                        </td>
                        <td className="p-4 font-black text-amber-950 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-black text-xs shrink-0">
                            {teacher.fullName.slice(0, 2)}
                          </div>
                          <span>{teacher.fullName}</span>
                        </td>
                        <td className="p-4 font-bold text-amber-800">
                          <span className="bg-amber-100/70 px-2.5 py-1 rounded-xl text-xs font-bold text-amber-900 border border-amber-200">
                            {teacher.position || 'ครู'}
                          </span>
                        </td>
                        <td className="p-4 font-black text-amber-900">
                          <span className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 text-xs inline-block">
                            {teacher.normalizedDept}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-rose-100 text-rose-700 border border-rose-300 px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                            ยังไม่ส่งแผน
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {teacher.everSubmitted ? (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 size={12} /> เคยส่งเทอมอื่น
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-xl border border-gray-200 inline-flex items-center gap-1">
                              <Clock size={12} /> ยังไม่เคยส่ง
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
