/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BarChart3, 
  PlusCircle, 
  CheckSquare, 
  UserCheck, 
  History, 
  Settings, 
  FileText, 
  Search, 
  Trash2, 
  Download, 
  Printer, 
  Loader2,
  Calendar,
  Layers,
  BookOpen,
  Star,
  FileDown,
  Users,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend,
  LabelList
} from 'recharts';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { CONFIG } from './constants';
import { DEFAULT_SHEET2_TEACHERS, Sheet2Teacher } from './data/defaultTeachers';
import { 
  fetchSheet2Teachers, 
  normalizeDepartment, 
  isTeacherSubmitted,
  isNamesFuzzyMatch,
  normalizeThaiName
} from './services/sheet2Service';
import UnsubmittedTeachersReport from './components/UnsubmittedTeachersReport';

// Types
interface LessonPlan {
  id: string;
  timestamp: string;
  userName: string;
  department: string;
  level: string;
  subjectId: string;
  subjectName: string;
  fileUrl: string;
  year: string;
  semester: string;
  status: 'pending' | 'checked' | 'approved';
  checkerName?: string;
  checkerPosition?: string;
  approverName?: string;
  approverPosition?: string;
  checkDate?: string;
  approveDate?: string;
}

export default function App() {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [teachers, setTeachers] = useState<Sheet2Teacher[]>(DEFAULT_SHEET2_TEACHERS);
  const [isRefreshingTeachers, setIsRefreshingTeachers] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Checker/Approver session info
  const [sessionUser, setSessionUser] = useState({ name: '', position: '' });

  // Check Section Filters
  const [checkSearch, setCheckSearch] = useState('');
  const [checkYear, setCheckYear] = useState('2569');
  const [checkTerm, setCheckTerm] = useState('1');
  const [checkDept, setCheckDept] = useState('ทั้งหมด');
  const [checkStatus, setCheckStatus] = useState('pending');

  // Dashboard Filters
  const [yearFilter, setYearFilter] = useState('2569');
  const [termFilter, setTermFilter] = useState('1');
  const [deptFilter, setDeptFilter] = useState('ทั้งหมด');
  const [hasUserChangedDashboardFilter, setHasUserChangedDashboardFilter] = useState(false);

  // History Filters
  const [hSearch, setHSearch] = useState('ทั้งหมด');
  const [hYear, setHYear] = useState('2569');
  const [hTerm, setHTerm] = useState('1');
  const [hDept, setHDept] = useState('ทั้งหมด');
  const [hCheckStatus, setHCheckStatus] = useState('ทั้งหมด');
  const [hApproveStatus, setHApproveStatus] = useState('ทั้งหมด');
  const [historyList, setHistoryList] = useState<LessonPlan[]>([]);
  const [filterVersion, setFilterVersion] = useState(0); // For manual trigger

  // Admin / Management Filters (กรองตามปีการศึกษา ภาคเรียน กลุ่มสาระ ครูผู้สอน)
  const [adminYear, setAdminYear] = useState('ทั้งหมด');
  const [adminTerm, setAdminTerm] = useState('ทั้งหมด');
  const [adminDept, setAdminDept] = useState('ทั้งหมด');
  const [adminTeacher, setAdminTeacher] = useState('ทั้งหมด');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminStatus, setAdminStatus] = useState('ทั้งหมด');

  // Standard 9 departments for Thai secondary schools
  const standardDeptOptions = useMemo(() => {
    const defaultList = [
      'วิทยาศาสตร์และเทคโนโลยี',
      'คณิตศาสตร์',
      'ภาษาไทย',
      'ภาษาต่างประเทศ',
      'สังคมศึกษา ศาสนาและวัฒนธรรม',
      'สุขศึกษาและพลศึกษา',
      'ศิลปะ',
      'การงานอาชีพ',
      'กิจกรรมพัฒนาผู้เรียน / แนะแนว'
    ];
    const set = new Set<string>(defaultList);
    teachers.forEach(t => {
      if (t.department) set.add(normalizeDepartment(t.department));
    });
    plans.forEach(p => {
      if (p.department) set.add(normalizeDepartment(p.department));
    });
    return Array.from(set).filter(Boolean);
  }, [teachers, plans]);

  // Robust department matching helper
  const isMatchDept = (planDept: string, filterDept: string, teacherName?: string): boolean => {
    if (!filterDept || filterDept === 'ทั้งหมด') return true;
    const targetNorm = normalizeDepartment(filterDept);

    if (planDept) {
      const pNorm = normalizeDepartment(planDept);
      if (pNorm === targetNorm) return true;
      if (planDept.trim() === filterDept.trim()) return true;
      if (pNorm.includes(targetNorm) || targetNorm.includes(pNorm)) return true;
    }

    if (teacherName) {
      const teacher = teachers.find(t => isNamesFuzzyMatch(t.fullName, teacherName));
      if (teacher && teacher.department) {
        const tNorm = normalizeDepartment(teacher.department);
        if (tNorm === targetNorm) return true;
        if (tNorm.includes(targetNorm) || targetNorm.includes(tNorm)) return true;
      }
    }

    return false;
  };

  // Robust year matching helper
  const isMatchYear = (planYear: any, filterYear: string): boolean => {
    if (!filterYear || filterYear === 'ทั้งหมด') return true;
    return String(planYear ?? '').trim() === String(filterYear).trim();
  };

  // Robust semester matching helper
  const isMatchTerm = (planTerm: any, filterTerm: string): boolean => {
    if (!filterTerm || filterTerm === 'ทั้งหมด') return true;
    const pDigits = String(planTerm ?? '').replace(/[^0-9]/g, '').trim();
    const fDigits = String(filterTerm).replace(/[^0-9]/g, '').trim();
    if (pDigits && fDigits) return pDigits === fDigits;
    return String(planTerm ?? '').trim() === String(filterTerm).trim();
  };

  // Robust search query & teacher matching helper
  const isMatchSearch = (plan: LessonPlan, query: string, filterTeacher: string = 'ทั้งหมด'): boolean => {
    if (filterTeacher && filterTeacher !== 'ทั้งหมด') {
      const planName = String(plan.userName || '').trim();
      const match = 
        planName.toLowerCase() === filterTeacher.trim().toLowerCase() ||
        normalizeThaiName(planName) === normalizeThaiName(filterTeacher) ||
        isNamesFuzzyMatch(planName, filterTeacher);
      if (!match) return false;
    }

    const q = query.trim().toLowerCase();
    if (!q) return true;

    const userName = String(plan.userName || '').toLowerCase();
    const subjectId = String(plan.subjectId || '').toLowerCase();
    const subjectName = String(plan.subjectName || '').toLowerCase();
    const department = String(plan.department || '').toLowerCase();
    const normDept = normalizeDepartment(plan.department || '').toLowerCase();

    return userName.includes(q) ||
      normalizeThaiName(userName).includes(normalizeThaiName(q)) ||
      isNamesFuzzyMatch(userName, q) ||
      subjectId.includes(q) ||
      subjectName.includes(q) ||
      department.includes(q) ||
      normDept.includes(q);
  };

  // Sheet 2 teachers grouped by department
  const sheet2TeachersByDept: Record<string, Sheet2Teacher[]> = useMemo(() => {
    const grouped: Record<string, Sheet2Teacher[]> = {};
    for (const t of teachers) {
      if (!t.fullName || !t.fullName.trim()) continue;
      const dept = normalizeDepartment(t.department || 'ไม่ระบุกลุ่มสาระ');
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(t);
    }
    return grouped;
  }, [teachers]);

  // Sheet 2 teachers belonging to currently selected department in history
  const sheet2TeachersInDept = useMemo(() => {
    if (hDept === 'ทั้งหมด') return [];
    const norm = normalizeDepartment(hDept);
    return teachers.filter(t => normalizeDepartment(t.department) === norm);
  }, [teachers, hDept]);

  // Sheet 2 teachers in other departments
  const sheet2TeachersOtherDepts = useMemo(() => {
    if (hDept === 'ทั้งหมด') return [];
    const norm = normalizeDepartment(hDept);
    return teachers.filter(t => normalizeDepartment(t.department) !== norm);
  }, [teachers, hDept]);

  // Sheet 2 teachers filtered for admin department
  const adminTeachersInDept = useMemo(() => {
    if (adminDept === 'ทั้งหมด') return teachers;
    const norm = normalizeDepartment(adminDept);
    return teachers.filter(t => normalizeDepartment(t.department) === norm);
  }, [teachers, adminDept]);

  // Non-Sheet2 names found in plans (for historical / external submissions)
  const extraPlanNames = useMemo<string[]>(() => {
    const sheet2Names = teachers.map(t => t.fullName.trim());
    return (Array.from(new Set(plans.map(p => p.userName?.trim())))
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      .filter(name => !sheet2Names.some(s2 => s2 === name || isNamesFuzzyMatch(s2, name))))
      .sort();
  }, [plans, teachers]);

  // Department options for history and admin filters
  const historyDeptOptions = useMemo(() => {
    return standardDeptOptions;
  }, [standardDeptOptions]);

  // All years available in the system
  const allYearOptions = useMemo(() => {
    const set = new Set<string>(CONFIG.YEARS);
    plans.forEach(p => {
      if (p.year) set.add(String(p.year).trim());
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [plans]);

  // Dynamically calculate latest academic year and semester from submitted plans
  const { latestYear, latestSemester } = useMemo(() => {
    if (!plans || plans.length === 0) {
      return {
        latestYear: CONFIG.CURRENT_YEAR || '2569',
        latestSemester: CONFIG.CURRENT_SEMESTER || '1'
      };
    }

    // Extract valid numeric years
    const validYears = plans
      .map(p => {
        const raw = String(p.year || '').trim();
        const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
        return { raw, num };
      })
      .filter(y => !isNaN(y.num) && y.num >= 2500 && y.num <= 2700);

    let maxYear = CONFIG.CURRENT_YEAR || '2569';
    if (validYears.length > 0) {
      validYears.sort((a, b) => b.num - a.num);
      maxYear = validYears[0].raw;
    }

    // For plans in the latest year, find maximum semester
    const termsInMaxYear = plans
      .filter(p => isMatchYear(p.year, maxYear))
      .map(p => {
        const raw = String(p.semester || '').trim();
        const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
        return { raw, num };
      })
      .filter(t => !isNaN(t.num));

    let maxTerm = CONFIG.CURRENT_SEMESTER || '1';
    if (termsInMaxYear.length > 0) {
      termsInMaxYear.sort((a, b) => b.num - a.num);
      maxTerm = String(termsInMaxYear[0].num);
    }

    return {
      latestYear: maxYear,
      latestSemester: maxTerm
    };
  }, [plans]);

  // Automatically default dashboard filters to latest academic year & semester
  useEffect(() => {
    if (plans.length > 0 && !hasUserChangedDashboardFilter) {
      setYearFilter(latestYear);
      setTermFilter(latestSemester);
    }
  }, [plans, latestYear, latestSemester, hasUserChangedDashboardFilter]);

  // Admin Filtered Plans (กรองตามปีการศึกษา ภาคเรียน กลุ่มสาระ ครูผู้สอน ค้นหา สถานะ)
  const adminFilteredPlans = useMemo(() => {
    return plans.filter(p => {
      const matchYear = isMatchYear(p.year, adminYear);
      const matchTerm = isMatchTerm(p.semester, adminTerm);
      const matchDept = isMatchDept(p.department, adminDept, p.userName);
      const matchSearch = isMatchSearch(p, adminSearch, adminTeacher);
      const matchStatus = adminStatus === 'ทั้งหมด' || p.status === adminStatus;

      return matchYear && matchTerm && matchDept && matchSearch && matchStatus;
    });
  }, [plans, adminYear, adminTerm, adminDept, adminTeacher, adminSearch, adminStatus, teachers]);

  const handleResetAdminFilters = () => {
    setAdminYear('ทั้งหมด');
    setAdminTerm('ทั้งหมด');
    setAdminDept('ทั้งหมด');
    setAdminTeacher('ทั้งหมด');
    setAdminSearch('');
    setAdminStatus('ทั้งหมด');
  };

  // Unified Filter Logic matching teacher names according to Sheet2
  useEffect(() => {
    const list = plans.filter(p => {
      const matchSearch = isMatchSearch(p, '', hSearch);
      const matchYear = isMatchYear(p.year, hYear);
      const matchTerm = isMatchTerm(p.semester, hTerm);
      const matchDept = isMatchDept(p.department, hDept, p.userName);
      
      let matchCheck = true;
      if (hCheckStatus === 'checked') matchCheck = p.status === 'checked' || p.status === 'approved';
      if (hCheckStatus === 'pending') matchCheck = p.status === 'pending';
      
      let matchApprove = true;
      if (hApproveStatus === 'approved') matchApprove = p.status === 'approved';
      if (hApproveStatus === 'pending') matchApprove = p.status === 'pending' || p.status === 'checked';

      return matchSearch && matchYear && matchTerm && matchDept && matchCheck && matchApprove;
    });
    setHistoryList(list);
  }, [plans, filterVersion, hSearch, hYear, hTerm, hDept, hCheckStatus, hApproveStatus, teachers]);

  const applyHistoryFilters = () => {
    setFilterVersion(v => v + 1);
    // Visual feedback
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'กรองข้อมูลเรียบร้อยแล้ว',
      showConfirmButton: false,
      timer: 1500,
      timerProgressBar: true
    });
  };

  const handleResetHistory = () => {
    setHSearch('ทั้งหมด');
    setHYear('2569');
    setHTerm('1');
    setHDept('ทั้งหมด');
    setHCheckStatus('ทั้งหมด');
    setHApproveStatus('ทั้งหมด');
    setFilterVersion(v => v + 1);
  };

  useEffect(() => {
    fetchData();
    reloadTeachers();
  }, []);

  const reloadTeachers = async () => {
    try {
      setIsRefreshingTeachers(true);
      const data = await fetchSheet2Teachers(CONFIG.SHEET_ID);
      if (data && data.length > 0) {
        setTeachers(data);
      }
    } catch (err) {
      console.warn('Could not reload Sheet2 teachers:', err);
    } finally {
      setIsRefreshingTeachers(false);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${CONFIG.SCRIPT_URL}?action=getData`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const formatted: LessonPlan[] = (data || []).map((p: any, idx: number) => ({
        ...p,
        id: p.id && String(p.id).trim().length > 0 
          ? String(p.id) 
          : `plan-${idx + 1}-${String(p.timestamp || '').replace(/[^a-zA-Z0-9]/g, '')}-${encodeURIComponent(String(p.userName || '').trim())}`
      }));
      setPlans(formatted);
    } catch (error) {
      console.error('Fetch error:', error);
      Swal.fire({
        title: 'เชื่อมต่อข้อมูลไม่ได้',
        text: 'กรูณาตรวจสอบการตั้งค่า Apps Script และการเชื่อมต่ออินเทอร์เน็ต',
        icon: 'warning',
        footer: `<div class="text-xs text-gray-500">Error: ${error instanceof Error ? error.message : String(error)}</div>`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const submitPlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fileUrl = formData.get('fileUrl') as string;

    if (!fileUrl || !fileUrl.startsWith('http')) {
      Swal.fire('ข้อผิดพลาด', 'กรุณาระบุลิงค์แผนการสอนที่ถูกต้อง', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      Swal.fire({
        title: 'กำลังบันทึกข้อมูล...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const res = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'submit',
          userName: formData.get('userName'),
          department: formData.get('department'),
          level: formData.get('level'),
          subjectId: formData.get('subjectId'),
          subjectName: formData.get('subjectName'),
          year: formData.get('year'),
          semester: formData.get('semester'),
          fileUrl: fileUrl
        })
      });
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();

      if (result.status === 'success') {
        Swal.fire('สำเร็จ!', 'ส่งแผนการสอนเรียบร้อยแล้ว', 'success');
        (e.target as HTMLFormElement).reset();
        fetchData();
        setActiveTab('history');
      } else {
        throw new Error(result.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
      }
    } catch (error) {
      console.error('Submit error:', error);
      Swal.fire({
        title: 'ส่งข้อมูลไม่สำเร็จ',
        text: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรูณาตรวจสอบการตั้งค่า Apps Script',
        icon: 'error',
        footer: `<div class="text-xs text-gray-500">Error: ${error instanceof Error ? error.message : String(error)}</div>`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = async (planId: string, type: 'check' | 'approve' | 'delete', data?: any) => {
    // Only prompt for password if not check/approve (which handle it in their custom dialogs)
    if (type === 'delete') {
      const { value: password } = await Swal.fire({
        title: 'ยืนยันรหัสผ่านผู้ดูแลระบบ',
        input: 'password',
        inputPlaceholder: 'รหัสผ่านแอดมิน',
        showCancelButton: true
      });

      if (password !== CONFIG.PASSWORDS.ADMIN) {
        if (password !== undefined) Swal.fire('ผิดพลาด', 'รหัสผ่านไม่ถูกต้อง', 'error');
        return;
      }
    }

    try {
      Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      
      const res = await fetch(CONFIG.SCRIPT_URL, { 
        method: 'POST', 
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: type,
          id: planId,
          ...data
        })
      });
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();

      if (result.status === 'success') {
        Swal.fire('สำเร็จ!', 'ดำเนินการเรียบร้อยแล้ว', 'success');
        fetchData();
      } else {
        Swal.fire('ผิดพลาด', result.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์', 'error');
      }
    } catch (error) {
      console.error('Action error:', error);
      Swal.fire({
        title: 'ดำเนินการไม่สำเร็จ',
        text: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
        icon: 'error',
        footer: `<div class="text-xs text-gray-500">Error: ${error instanceof Error ? error.message : String(error)}</div>`
      });
    }
  };

  const printDocument = (plan: LessonPlan) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>บันทึกการส่งแผน - ${plan.userName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Prompt&display=swap');
            body { font-family: 'Prompt', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { width: 100px; }
            .content { border: 1px solid #ddd; padding: 30px; border-radius: 10px; }
            .row { margin-bottom: 15px; display: flex; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .label { font-weight: bold; width: 200px; }
            .footer { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .sign-box { text-align: center; border-top: 1px solid #000; padding-top: 10px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="https://img2.pic.in.th/1254688019cc1bf56ff5775.jpg" class="logo" />
            <h1>บันทึกข้อมูลการส่งแผนการจัดการเรียนรู้</h1>
            <h3>โรงเรียนท่าบ่อ สพม.หนองคาย</h3>
          </div>
          <div class="content">
            <div class="row"><span class="label">วันที่ส่ง:</span> <span>${plan.timestamp}</span></div>
            <div class="row"><span class="label">ชื่อ-นามสกุล:</span> <span>${plan.userName}</span></div>
            <div class="row"><span class="label">กลุ่มสาระฯ:</span> <span>${plan.department}</span></div>
            <div class="row"><span class="label">ระดับชั้น:</span> <span>${plan.level}</span></div>
            <div class="row"><span class="label">รหัสวิชา:</span> <span>${plan.subjectId}</span></div>
            <div class="row"><span class="label">ชื่อวิชา:</span> <span>${plan.subjectName}</span></div>
            <div class="row"><span class="label">ปีการศึกษา/ภาคเรียน:</span> <span>${plan.year}/${plan.semester}</span></div>
            <div class="row"><span class="label">สถานะ:</span> <span>${plan.status === 'approved' ? 'อนุมัติแล้ว' : 'รอการอนุมัติ'}</span></div>
          </div>
          <div class="footer">
            <div class="sign-box">
              <p>( ${plan.checkerName || '...........................................'} )</p>
              <p>${plan.checkerPosition || 'ผู้ตรวจแผน'}</p>
            </div>
            <div class="sign-box">
              <p>( ${plan.approverName || '...........................................'} )</p>
              <p>${plan.approverPosition || 'ผู้อำนวยการโรงเรียนท่าบ่อ'}</p>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Dashboard Stats
  const filteredPlans = plans.filter(p => 
    (yearFilter === 'ทั้งหมด' || String(p.year) === String(yearFilter)) &&
    (termFilter === 'ทั้งหมด' || String(p.semester) === String(termFilter)) &&
    (deptFilter === 'ทั้งหมด' || String(p.department) === String(deptFilter))
  );

  const stats = {
    total: filteredPlans.length,
    checked: filteredPlans.filter(p => p.status === 'checked' || p.status === 'approved').length,
    approved: filteredPlans.filter(p => p.status === 'approved').length,
    pending: filteredPlans.filter(p => p.status === 'pending').length
  };

  const getShortDeptName = (dept: string) => {
    if (dept.includes('วิทยาศาสตร์')) return 'วิทยาศาสตร์ฯ';
    if (dept.includes('สังคมศึกษา')) return 'สังคมศึกษาฯ';
    if (dept.includes('สุขศึกษา') || dept.includes('พลศึกษา')) return 'สุขศึกษา/พลฯ';
    if (dept.includes('กิจกรรมพัฒนาผู้เรียน') || dept.includes('แนะแนว')) return 'แนะแนว/กิจกรรมฯ';
    if (dept.includes('ต่างประเทศ')) return 'ต่างประเทศ';
    return dept;
  };

  const chartData = useMemo(() => {
    const baseDepts = [
      'วิทยาศาสตร์และเทคโนโลยี',
      'คณิตศาสตร์',
      'ศิลปะ',
      'ภาษาไทย',
      'ภาษาต่างประเทศ',
      'สังคมศึกษา ศาสนาและวัฒนธรรม',
      'การงานอาชีพ',
      'สุขศึกษาและพลศึกษา',
      'กิจกรรมพัฒนาผู้เรียน / แนะแนว'
    ];

    const targetDepts = deptFilter === 'ทั้งหมด' 
      ? baseDepts 
      : baseDepts.filter(d => {
          const normFilter = normalizeDepartment(deptFilter);
          const normD = normalizeDepartment(d);
          return normD === normFilter || d === deptFilter || d.includes(deptFilter) || deptFilter.includes(d);
        });

    return targetDepts.map(dept => {
      const normDept = normalizeDepartment(dept);
      
      // Teachers in this department from Sheet2
      const deptTeachers = teachers.filter(t => normalizeDepartment(t.department) === normDept);
      const totalTeachers = deptTeachers.length;

      // Teachers who have submitted a lesson plan matching yearFilter and termFilter
      const submittedTeachers = deptTeachers.filter(t => 
        isTeacherSubmitted(t, plans, yearFilter, termFilter).hasSubmitted
      );

      const submittedCount = submittedTeachers.length;
      const unsubmittedCount = Math.max(0, totalTeachers - submittedCount);

      return {
        name: dept,
        displayName: getShortDeptName(dept),
        fullname: dept,
        submitted: submittedCount,
        unsubmitted: unsubmittedCount,
        total: totalTeachers,
        rate: totalTeachers > 0 ? Math.round((submittedCount / totalTeachers) * 100) : 0
      };
    });
  }, [teachers, plans, yearFilter, termFilter, deptFilter]);

  const NavButton = ({ tabId, icon: Icon, label, color, isProtected }: { tabId: string, icon: any, label: string, color: string, isProtected?: boolean }) => {
    const handleTabClick = async () => {
      if (activeTab === tabId) return;
      
      if (isProtected) {
        const passwordMap: Record<string, string> = {
          check: CONFIG.PASSWORDS.CHECK,
          approve: CONFIG.PASSWORDS.APPROVE,
          admin: CONFIG.PASSWORDS.ADMIN
        };

        if (tabId === 'check' || tabId === 'approve') {
          const { value: formValues } = await Swal.fire({
            title: `ยืนยันตัวตนสำหรับเมนู${label}`,
            html: `
              <div class="space-y-4 p-2 text-left">
                <div>
                  <label class="block text-xs font-black text-amber-900 mb-1">รหัสผ่าน</label>
                  <input id="nav-pass" type="password" class="swal2-input !m-0 !w-full" placeholder="รหัสผ่าน">
                </div>
                <div>
                  <label class="block text-xs font-black text-amber-900 mb-1">ชื่อ-นามสกุล ${tabId === 'check' ? 'ผู้ตรวจ' : 'ผู้อนุมัติ'}</label>
                  <input id="nav-name" class="swal2-input !m-0 !w-full" placeholder="ระบุชื่อ-นามสกุล">
                </div>
                <div>
                  <label class="block text-xs font-black text-amber-900 mb-1">ตำแหน่ง</label>
                  <input id="nav-pos" class="swal2-input !m-0 !w-full" placeholder="ระบุตำแหน่ง">
                </div>
              </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'เข้าใช้งาน',
            cancelButtonText: 'ยกเลิก',
            preConfirm: () => {
              const pass = (document.getElementById('nav-pass') as HTMLInputElement).value;
              const name = (document.getElementById('nav-name') as HTMLInputElement).value;
              const pos = (document.getElementById('nav-pos') as HTMLInputElement).value;
              
              if (pass !== passwordMap[tabId]) {
                Swal.showValidationMessage('รหัสผ่านไม่ถูกต้อง');
                return false;
              }
              if (!name || !pos) {
                Swal.showValidationMessage('กรุณากรอกข้อมูลชื่อและตำแหน่งให้ครบถ้วน');
                return false;
              }
              return { name, position: pos };
            }
          });

          if (formValues) {
            setSessionUser(formValues);
            setActiveTab(tabId);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return;
        }

        const { value: password } = await Swal.fire({
          title: 'กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน',
          input: 'password',
          inputPlaceholder: 'รหัสผ่าน',
          showCancelButton: true
        });

        if (password === passwordMap[tabId]) {
          setActiveTab(tabId);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (password !== undefined) {
          Swal.fire('ผิดพลาด', 'รหัสผ่านไม่ถูกต้อง', 'error');
        }
      } else {
        setActiveTab(tabId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    return (
      <button 
        onClick={handleTabClick}
        className={`flex flex-col items-center gap-2 p-2 transition-all hover:scale-105 group ${activeTab === tabId ? 'scale-110' : 'opacity-70'}`}
      >
        <div className={`w-14 h-14 md:w-20 md:h-20 rounded-2xl flex items-center justify-center shadow-lg ${color} ${activeTab === tabId ? 'ring-4 ring-amber-500' : 'group-hover:ring-4 group-hover:ring-amber-300'} transition-all border-2 border-white`}>
          <Icon size={32} className="text-amber-900" />
        </div>
        <span className={`text-xs md:text-lg font-black text-amber-950 tracking-tight ${activeTab === tabId ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBBF24] p-4 md:p-10">
      {/* Unified White Sheet */}
      <div className="max-w-7xl mx-auto w-full bg-white rounded-[48px] shadow-2xl border-[12px] border-amber-600/10 overflow-hidden flex flex-col">
        
        {/* Header Section (Part of the sheet) */}
        <header className="bg-amber-50/50 py-12 px-10 flex flex-col items-center gap-10 border-b-4 border-amber-100">
           {/* Logo & Title */}
           <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <motion.img 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src="https://img1.pic.in.th/images/logotbs_02-2-2.png" 
                alt="Logo" 
                className="w-[140px] md:w-[180px] animate-float drop-shadow-xl"
              />
              <div className="space-y-1">
                <h1 className="text-3xl md:text-5xl font-black text-amber-950 tracking-tighter leading-tight">
                  ระบบส่งแผนการจัดการเรียนรู้ออนไลน์
                </h1>
                <p className="text-xl md:text-2xl text-amber-600 font-black opacity-90 uppercase tracking-[0.2em]">
                  โรงเรียนท่าบ่อ สพม.หนองคาย
                </p>
              </div>
           </div>

           {/* Large Navigation Menu */}
           <nav className="w-full max-w-5xl bg-white rounded-[32px] p-4 shadow-xl border-2 border-amber-200 flex flex-wrap justify-center items-center gap-4 md:gap-10">
              <NavButton tabId="dashboard" icon={BarChart3} label="สถิติ" color="bg-yellow-100" />
              <NavButton tabId="submit" icon={PlusCircle} label="ส่งแผน" color="bg-amber-400/20" />
              <NavButton tabId="check" icon={CheckSquare} label="ตรวจแผน" color="bg-orange-100" isProtected />
              <NavButton tabId="approve" icon={UserCheck} label="อนุมัติ" color="bg-blue-100" isProtected />
              <NavButton tabId="history" icon={History} label="ประวัติ" color="bg-green-100" />
              <NavButton tabId="admin" icon={Settings} label="จัดการ" color="bg-gray-100" isProtected />
           </nav>
        </header>

        {/* Content Body */}
        <div className="p-6 md:p-16 min-h-[600px]">
           {isLoading ? (
             <div className="flex flex-col items-center justify-center p-20 gap-6">
               <Loader2 className="animate-spin text-amber-600" size={80} />
               <p className="text-amber-950 font-black text-2xl italic animate-pulse">กำลังเตรียมเอกสาร...</p>
             </div>
           ) : (
             <AnimatePresence mode="wait">
               {activeTab === 'dashboard' && (
                 <motion.section 
                   key="dashboard"
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -20 }}
                   className="space-y-12"
                 >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-[12px] border-amber-500 pl-8 h-auto py-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <BarChart3 size={38} className="text-amber-600" />
                          <h2 className="text-3xl md:text-4xl font-black text-amber-950 leading-none">สถิติและรายงานข้อมูลการส่งแผน</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 pt-1 text-sm md:text-base font-bold text-amber-900/80">
                          <span className="bg-amber-600 text-white text-xs md:text-sm font-black px-3.5 py-1.5 rounded-2xl shadow-sm flex items-center gap-2">
                            <Calendar size={16} />
                            <span>ปีการศึกษาและภาคเรียนล่าสุด: ปีการศึกษา {latestYear} ภาคเรียนที่ {latestSemester}</span>
                          </span>
                          <span className="text-xs font-black text-amber-950 bg-amber-100 px-3 py-1 rounded-xl border border-amber-300">
                            ข้อมูลที่กำลังแสดง: {yearFilter === 'ทั้งหมด' ? 'ทุกปีการศึกษา' : `ปีการศึกษา ${yearFilter}`} {termFilter === 'ทั้งหมด' ? 'ทุกภาคเรียน' : `ภาคเรียนที่ ${termFilter}`}
                          </span>
                          {yearFilter === latestYear && termFilter === latestSemester ? (
                            <span className="bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse"></span>
                              ภาคเรียนล่าสุด
                            </span>
                          ) : (
                            <span className="bg-amber-200 text-amber-950 text-xs font-black px-3 py-1 rounded-full">
                              ข้อมูลย้อนหลัง / กรองกำหนดเอง
                            </span>
                          )}
                        </div>
                      </div>

                      {(yearFilter !== latestYear || termFilter !== latestSemester) && (
                        <button
                          onClick={() => {
                            setYearFilter(latestYear);
                            setTermFilter(latestSemester);
                            setHasUserChangedDashboardFilter(false);
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-md transition-all self-start md:self-auto active:scale-95"
                          title={`สลับกลับสู่ปีการศึกษา ${latestYear} ภาคเรียนที่ ${latestSemester} (ล่าสุด)`}
                        >
                          <RefreshCw size={16} />
                          <span>ดูปีและภาคเรียนล่าสุด ({latestSemester}/{latestYear})</span>
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { label: 'ส่งแผนทั้งหมด', value: stats.total, color: 'bg-yellow-200', icon: FileText, sub: `เทอม ${termFilter}/${yearFilter}` },
                        { label: 'ผ่านการตรวจ', value: stats.checked, color: 'bg-blue-200', icon: CheckSquare, sub: 'ตรวจลงนามแล้ว' },
                        { label: 'อนุมัติแล้ว', value: stats.approved, color: 'bg-green-200', icon: Star, sub: 'ผู้อำนวยการอนุมัติ' },
                        { label: 'รอรับการตรวจ', value: stats.pending, color: 'bg-orange-200', icon: Loader2, sub: 'รอหัวหน้ากลุ่มตรวจ' },
                      ].map((item, idx) => (
                        <div key={idx} className={`${item.color} p-8 rounded-[40px] border-4 border-white shadow-xl flex flex-col gap-3 hover:-translate-y-2 transition-all duration-300`}>
                          <div className="flex items-center justify-between">
                            <item.icon size={32} className="text-amber-900 opacity-80" />
                            <span className="text-[11px] font-black text-amber-900/70 bg-white/60 px-2 py-0.5 rounded-lg">{item.sub}</span>
                          </div>
                          <span className="text-sm font-black text-amber-900/60 uppercase tracking-widest leading-none">{item.label}</span>
                          <span className="text-5xl font-black text-amber-950 leading-none">{item.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Unsubmitted Teachers Report from Sheet2 */}
                    <UnsubmittedTeachersReport
                      teachers={teachers}
                      plans={plans}
                      yearFilter={yearFilter}
                      termFilter={termFilter}
                      latestYear={latestYear}
                      latestSemester={latestSemester}
                      allYearOptions={allYearOptions}
                      onYearChange={(y) => {
                        setYearFilter(y);
                        setHasUserChangedDashboardFilter(true);
                      }}
                      onTermChange={(t) => {
                        setTermFilter(t);
                        setHasUserChangedDashboardFilter(true);
                      }}
                      onRefreshTeachers={reloadTeachers}
                      isRefreshing={isRefreshingTeachers}
                    />

                    <div className="minimal-card space-y-8 bg-white border-[8px] border-amber-100 p-8 md:p-12 shadow-xl">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b-4 border-amber-50">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-2xl font-black text-amber-950 flex items-center gap-3">
                              <BarChart3 className="text-amber-600" size={28} /> สถิติการส่งแผนจำแนกตามกลุ่มสาระการเรียนรู้
                            </h3>
                            {yearFilter === latestYear && termFilter === latestSemester && (
                              <span className="bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse"></span>
                                ปีการศึกษาและภาคเรียนล่าสุด
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-amber-800/70 mt-1">
                            ประจำภาคเรียนที่ <span className="font-black text-amber-950">{termFilter}</span> ปีการศึกษา <span className="font-black text-amber-950">{yearFilter}</span>
                            {yearFilter === latestYear && termFilter === latestSemester && (
                              <span className="text-emerald-700 font-black"> (ปีการศึกษาและภาคเรียนล่าสุด)</span>
                            )}
                            {' '}• เปรียบเทียบจำนวนครู <span className="text-emerald-700 font-black">"ส่งแล้ว"</span> และ <span className="text-rose-600 font-black">"ค้างส่ง"</span> (ครูทั้งหมด {teachers.length} คน)
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-2xl border-2 border-amber-200">
                            <Calendar size={18} className="text-amber-700" />
                            <select 
                              className="bg-transparent text-sm md:text-base font-black text-amber-950 py-1 pr-2 outline-none cursor-pointer" 
                              value={yearFilter} 
                              onChange={(e) => {
                                setYearFilter(e.target.value);
                                setHasUserChangedDashboardFilter(true);
                              }}
                            >
                              <option value="ทั้งหมด">ปีการศึกษา: ทั้งหมด</option>
                              {allYearOptions.map(y => (
                                <option key={y} value={y}>
                                  ปีการศึกษา {y} {y === latestYear ? '(ล่าสุด)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-2xl border-2 border-amber-200">
                            <Layers size={18} className="text-amber-700" />
                            <select 
                              className="bg-transparent text-sm md:text-base font-black text-amber-950 py-1 pr-2 outline-none cursor-pointer" 
                              value={termFilter} 
                              onChange={(e) => {
                                setTermFilter(e.target.value);
                                setHasUserChangedDashboardFilter(true);
                              }}
                            >
                              <option value="ทั้งหมด">ภาคเรียน: ทั้งหมด</option>
                              {CONFIG.SEMESTERS.map(s => (
                                <option key={s} value={s}>
                                  ภาคเรียนที่ {s} {yearFilter === latestYear && s === latestSemester ? '(ล่าสุด)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-2xl border-2 border-amber-200">
                            <BookOpen size={18} className="text-amber-700" />
                            <select className="bg-transparent text-sm md:text-base font-black text-amber-950 py-1 pr-2 outline-none cursor-pointer" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                              {['ทั้งหมด', ...CONFIG.DEPARTMENTS].map(d => <option key={d} value={d}>{d === 'ทั้งหมด' ? 'กลุ่มสาระ: ทั้งหมด' : d}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Legend explanation bar */}
                      <div className="flex flex-wrap items-center justify-between gap-4 bg-amber-50/70 p-4 rounded-2xl border border-amber-200">
                        <div className="flex flex-wrap items-center gap-6 text-sm font-black">
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-md bg-emerald-600 shadow-sm inline-block"></span>
                            <span className="text-emerald-900">แท่งสีเขียว: ส่งแล้ว</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-md bg-rose-600 shadow-sm inline-block"></span>
                            <span className="text-rose-900">แท่งสีแดง: ค้างส่ง</span>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-amber-800">
                          * แสดงตัวเลขจำนวนครู (คน) บนหัวแท่งกราฟ
                        </div>
                      </div>

                      <div className="h-[480px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 35, right: 25, left: 0, bottom: 95 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#FED7AA" strokeWidth={1.5} />
                            <XAxis 
                              dataKey="displayName" 
                              angle={-35} 
                              textAnchor="end" 
                              interval={0} 
                              height={90}
                              tick={{ fontSize: 13, fontWeight: 900, fill: '#451A03' }} 
                            />
                            <YAxis 
                              allowDecimals={false}
                              tick={{ fontSize: 13, fontWeight: 900, fill: '#451A03' }} 
                              domain={[0, (dataMax: number) => Math.max(5, Math.ceil(dataMax * 1.15) + 1)]}
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(251, 191, 36, 0.12)' }}
                              contentStyle={{ 
                                borderRadius: '20px', 
                                border: '3px solid #F59E0B', 
                                backgroundColor: '#FFFFFF',
                                padding: '14px 18px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
                              }}
                              formatter={(value: any, name: any) => [
                                `${value} คน`,
                                name
                              ]}
                              labelFormatter={(_label: any, payload: any) => {
                                const item = payload?.[0]?.payload;
                                return item?.fullname ? `กลุ่มสาระฯ ${item.fullname} (ครู ${item.total} คน)` : _label;
                              }}
                            />
                            <Legend 
                              verticalAlign="top" 
                              align="right"
                              wrapperStyle={{ paddingBottom: '25px', fontWeight: 900, fontSize: 14 }} 
                            />
                            <Bar 
                              dataKey="submitted" 
                              name="ส่งแล้ว (คน)" 
                              fill="#059669" 
                              radius={[8, 8, 0, 0]}
                              maxBarSize={45}
                            >
                              <LabelList 
                                dataKey="submitted" 
                                position="top" 
                                offset={8}
                                formatter={(val: any) => typeof val === 'number' ? val : ''}
                                style={{ fontWeight: 900, fontSize: 13, fill: '#059669' }} 
                              />
                            </Bar>
                            <Bar 
                              dataKey="unsubmitted" 
                              name="ค้างส่ง (คน)" 
                              fill="#DC2626" 
                              radius={[8, 8, 0, 0]}
                              maxBarSize={45}
                            >
                              <LabelList 
                                dataKey="unsubmitted" 
                                position="top" 
                                offset={8}
                                formatter={(val: any) => typeof val === 'number' ? val : ''}
                                style={{ fontWeight: 900, fontSize: 13, fill: '#DC2626' }} 
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Summary badges below chart */}
                      <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 pt-4 border-t-2 border-amber-100 text-sm font-black">
                        <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-200 shadow-sm">
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 inline-block"></span>
                          <span>ส่งแล้วรวม: {chartData.reduce((acc, cur) => acc + cur.submitted, 0)} คน</span>
                        </div>
                        <div className="flex items-center gap-2 text-rose-800 bg-rose-50 px-4 py-2 rounded-2xl border border-rose-200 shadow-sm">
                          <span className="w-3.5 h-3.5 rounded-full bg-rose-600 inline-block"></span>
                          <span>ค้างส่งรวม: {chartData.reduce((acc, cur) => acc + cur.unsubmitted, 0)} คน</span>
                        </div>
                        <div className="flex items-center gap-2 text-amber-900 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-200 shadow-sm">
                          <Users size={16} className="text-amber-700" />
                          <span>ครูในแผนภูมิ: {chartData.reduce((acc, cur) => acc + cur.total, 0)} คน</span>
                        </div>
                      </div>
                    </div>
                 </motion.section>
               )}

               {activeTab === 'submit' && (
                 <motion.section 
                    key="submit"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="max-w-4xl mx-auto w-full space-y-12"
                 >
                    <div className="text-center space-y-6">
                      <div className="w-24 h-24 bg-amber-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl border-4 border-white">
                        <PlusCircle className="text-white" size={48} />
                      </div>
                      <h2 className="text-4xl md:text-5xl font-black text-amber-950 tracking-tight">แบบฟอร์มส่งแผนการจัดการเรียนรู้</h2>
                      <p className="text-lg md:text-xl text-amber-700/60 font-black uppercase tracking-[0.3em]">
                        แบบฟอร์มการส่ง
                      </p>
                    </div>

                    <form onSubmit={submitPlan} className="minimal-card space-y-8 bg-white border-[8px] border-amber-500 p-10 md:p-14 shadow-xl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-xl font-black text-amber-950 flex items-center gap-3">
                            <UserCheck size={28} className="text-amber-500" /> ชื่อ-นามสกุลครูผู้สอน
                          </label>
                          <input 
                            name="userName" 
                            required 
                            placeholder="ระบุชื่อจริง-นามสกุล" 
                            list="sheet2-teachers-datalist"
                            className="input-field" 
                          />
                          <datalist id="sheet2-teachers-datalist">
                            {teachers.map(t => (
                              <option key={t.no || t.fullName} value={t.fullName}>
                                {t.department} ({t.position || 'ครู'})
                              </option>
                            ))}
                          </datalist>
                        </div>
                        <div className="space-y-3">
                          <label className="text-xl font-black text-amber-950 flex items-center gap-3">
                            <Layers size={28} className="text-amber-500" /> กลุ่มสาระการเรียนรู้
                          </label>
                          <select name="department" required className="input-field">
                            <option value="">เลือกกลุ่มสาระฯ</option>
                            {CONFIG.DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-xl font-black text-amber-950 flex items-center gap-3">
                            <Calendar size={28} className="text-amber-500" /> ปีการศึกษา / ภาคเรียน
                          </label>
                          <div className="flex gap-4">
                            <select name="year" required defaultValue={CONFIG.CURRENT_YEAR} className="input-field flex-1">
                              {CONFIG.YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <select name="semester" required defaultValue={CONFIG.CURRENT_SEMESTER} className="input-field flex-1">
                              {CONFIG.SEMESTERS.map(s => <option key={s} value={s}>เทอม {s}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-xl font-black text-amber-950 flex items-center gap-3">
                            <FileText size={28} className="text-amber-500" /> ระดับชั้นที่สอน
                          </label>
                          <select name="level" required className="input-field">
                            {CONFIG.LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-xl font-black text-amber-950 flex items-center gap-3">
                            <BookOpen size={28} className="text-amber-500" /> รหัสวิชา
                          </label>
                          <input name="subjectId" required placeholder="ตัวอย่าง: ว31101" className="input-field" />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xl font-black text-amber-950 flex items-center gap-3">
                            <BookOpen size={28} className="text-amber-500" /> ชื่อรายวิชา
                          </label>
                          <input name="subjectName" required placeholder="ตัวอย่าง: วิทยาศาสตร์พื้นฐาน" className="input-field" />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <label className="text-xl font-black text-amber-950 flex items-center gap-3">
                          <FileDown size={28} className="text-amber-500" /> ลิงค์แผนการจัดการเรียนรู้ (เช่น Google Drive)
                        </label>
                        <div className="relative group">
                          <input 
                            name="fileUrl" 
                            required 
                            placeholder="วางลิงก์เอกสารที่นี่ (ต้องแชร์เป็น 'ทุกคนที่มีลิงก์สามารถอ่านได้')" 
                            className="input-field pl-14 h-20 text-lg"
                          />
                          <Download className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-300 group-focus-within:text-amber-600" size={32} />
                        </div>
                        <p className="text-amber-600 font-extrabold italic opacity-60 text-sm px-2">
                          * กรุณาตรวจสอบการตั้งค่าการแชร์ให้เป็นสาธารณะ (Anyone with link)
                        </p>
                      </div>

                      <button type="submit" disabled={isSubmitting} className="btn-primary w-full h-20 text-2xl shadow-xl">
                        {isSubmitting ? <><Loader2 className="animate-spin" /> กำลังบันทึกข้อมูล...</> : '📤 ยืนยันการส่งแผนการสอน'}
                      </button>
                    </form>
                 </motion.section>
               )}

               {activeTab === 'check' && (
                 <motion.section 
                    key="check"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                 >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-[16px] border-orange-500 pl-8 h-auto py-2">
                       <div className="flex items-center gap-4">
                         <CheckSquare size={40} className="text-orange-500" />
                         <h2 className="text-3xl md:text-5xl font-black text-amber-950">ตรวจแผนการจัดการเรียนรู้ (เฉพาะรอการตรวจ)</h2>
                       </div>
                       <div className="text-right">
                         <p className="text-amber-900 font-black text-lg">ผู้ตรวจ: {sessionUser.name}</p>
                         <p className="text-amber-600 font-bold text-sm tracking-wider">{sessionUser.position}</p>
                       </div>
                    </div>

                    {/* Check Filters (Simplified for pending only by default) */}
                    <div className="bg-amber-50 p-6 rounded-3xl border-2 border-amber-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-black text-amber-900 px-1">ค้นหาชื่อครู</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={18} />
                          <input 
                            type="text" 
                            placeholder="ระบุชื่อ-สกุล..." 
                            className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-bold h-11 pl-10"
                            value={checkSearch}
                            onChange={(e) => setCheckSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-black text-amber-900 px-1">ปีการศึกษา</label>
                        <select className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-bold h-11" value={checkYear} onChange={(e) => setCheckYear(e.target.value)}>
                          {['ทั้งหมด', ...CONFIG.YEARS].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-black text-amber-900 px-1">ภาคเรียน</label>
                        <select className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-bold h-11" value={checkTerm} onChange={(e) => setCheckTerm(e.target.value)}>
                          {['ทั้งหมด', ...CONFIG.SEMESTERS].map(s => <option key={s} value={s}>{s === 'ทั้งหมด' ? s : `ภาคเรียนที่ ${s}`}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-black text-amber-900 px-1">กลุ่มสาระ</label>
                        <select className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-bold h-11" value={checkDept} onChange={(e) => setCheckDept(e.target.value)}>
                          {['ทั้งหมด', ...CONFIG.DEPARTMENTS].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>

                    {renderCheckTable('pending')}
                 </motion.section>
               )}

               {activeTab === 'approve' && (
                 <motion.section 
                    key="approve"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                 >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-[16px] border-blue-500 pl-8 h-auto py-2">
                       <div className="flex items-center gap-4">
                         <UserCheck size={40} className="text-blue-500" />
                         <h2 className="text-3xl md:text-5xl font-black text-amber-950">อนุมัติแผนการจัดการเรียนรู้ (เฉพาะที่ตรวจแล้ว)</h2>
                       </div>
                       <div className="text-right">
                         <p className="text-amber-900 font-black text-lg">ผู้อนุมัติ: {sessionUser.name}</p>
                         <p className="text-amber-600 font-bold text-sm tracking-wider">{sessionUser.position}</p>
                       </div>
                    </div>

                    <div className="bg-amber-50 p-6 rounded-3xl border-2 border-amber-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-black text-amber-900 px-1">ค้นหาชื่อครู</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={18} />
                          <input 
                            type="text" 
                            placeholder="ระบุชื่อ-สกุล..." 
                            className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-bold h-11 pl-10"
                            value={checkSearch}
                            onChange={(e) => setCheckSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-black text-amber-900 px-1">ปีการศึกษา</label>
                        <select className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-bold h-11" value={checkYear} onChange={(e) => setCheckYear(e.target.value)}>
                          {['ทั้งหมด', ...CONFIG.YEARS].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-black text-amber-900 px-1">ภาคเรียน</label>
                        <select className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-bold h-11" value={checkTerm} onChange={(e) => setCheckTerm(e.target.value)}>
                          {['ทั้งหมด', ...CONFIG.SEMESTERS].map(s => <option key={s} value={s}>{s === 'ทั้งหมด' ? s : `ภาคเรียนที่ ${s}`}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-black text-amber-900 px-1">กลุ่มสาระ</label>
                        <select className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-bold h-11" value={checkDept} onChange={(e) => setCheckDept(e.target.value)}>
                          {['ทั้งหมด', ...CONFIG.DEPARTMENTS].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>

                    {renderCheckTable('checked')}
                 </motion.section>
               )}

               {activeTab === 'history' && (
                 <motion.section 
                    key="history"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-8"
                 >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-[16px] border-green-500 pl-8 h-auto py-2">
                       <div className="flex items-center gap-4">
                         <History size={40} className="text-green-500" />
                         <div>
                           <div className="flex flex-wrap items-center gap-3">
                             <h2 className="text-3xl md:text-5xl font-black text-amber-950">ประวัติการส่งแผนการสอน</h2>
                             <span className="bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                               <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse"></span>
                               ค่าเริ่มต้น: ภาคเรียนที่ {CONFIG.CURRENT_SEMESTER}/{CONFIG.CURRENT_YEAR}
                             </span>
                           </div>
                           <p className="text-sm font-bold text-amber-800/80 mt-1">
                             แสดงข้อมูลตามปีและภาคเรียนที่เลือก สามารถเลือกเปลี่ยนเงื่อนไขหรือเลือก "ทั้งหมด" เพื่อดูย้อนหลังได้
                           </p>
                         </div>
                       </div>
                    </div>

                    {/* History Filter Bar */}
                    <div className="bg-amber-50 p-4 rounded-3xl border-2 border-amber-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-900 px-1">เลือกชื่อครู (ตาม Sheet2)</label>
                        <select 
                          className="w-full px-2 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-[10px] font-bold h-9 cursor-pointer hover:border-amber-400" 
                          value={hSearch} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setHSearch(val);
                            if (val !== 'ทั้งหมด') {
                              const found = teachers.find(t => t.fullName === val);
                              if (found && hDept !== 'ทั้งหมด') {
                                const teacherDept = normalizeDepartment(found.department);
                                if (teacherDept !== normalizeDepartment(hDept)) {
                                  setHDept(teacherDept);
                                }
                              }
                            }
                          }}
                        >
                          <option value="ทั้งหมด">ทั้งหมด (ครูทุกคน)</option>
                          {hDept === 'ทั้งหมด' ? (
                            (Object.entries(sheet2TeachersByDept) as [string, Sheet2Teacher[]][]).map(([dept, tList]) => (
                              <optgroup key={dept} label={`กลุ่มสาระ${dept} (${tList.length} คน)`}>
                                {tList.map(t => (
                                  <option key={t.no ? `s2-${t.no}` : t.fullName} value={t.fullName}>
                                    {t.fullName}
                                  </option>
                                ))}
                              </optgroup>
                            ))
                          ) : (
                            <>
                              {sheet2TeachersInDept.length > 0 && (
                                <optgroup label={`ครูกลุ่มสาระ${hDept} (Sheet 2 - ${sheet2TeachersInDept.length} คน)`}>
                                  {sheet2TeachersInDept.map(t => (
                                    <option key={t.no ? `s2-dept-${t.no}` : t.fullName} value={t.fullName}>
                                      {t.fullName}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {sheet2TeachersOtherDepts.length > 0 && (
                                <optgroup label="ครูกลุ่มสาระอื่น ๆ (Sheet 2)">
                                  {sheet2TeachersOtherDepts.map(t => (
                                    <option key={t.no ? `s2-other-${t.no}` : t.fullName} value={t.fullName}>
                                      {t.fullName} ({t.department})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </>
                          )}
                          {extraPlanNames.length > 0 && (
                            <optgroup label="รายชื่ออื่น ๆ นอกเหนือจาก Sheet 2">
                              {extraPlanNames.map(name => (
                                <option key={`extra-${name}`} value={name}>
                                  {name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-900 px-1">ปีการศึกษา</label>
                        <select 
                          className="w-full px-2 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-[10px] font-bold h-9 cursor-pointer hover:border-amber-400" 
                          value={hYear} 
                          onChange={(e) => setHYear(e.target.value)}
                        >
                          <option value="ทั้งหมด">ทั้งหมด</option>
                          {CONFIG.YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-900 px-1">ภาคเรียน</label>
                        <select 
                          className="w-full px-2 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-[10px] font-bold h-9 cursor-pointer hover:border-amber-400" 
                          value={hTerm} 
                          onChange={(e) => setHTerm(e.target.value)}
                        >
                          <option value="ทั้งหมด">ทั้งหมด</option>
                          {CONFIG.SEMESTERS.map(s => <option key={s} value={s}>{`ภาคเรียนที่ ${s}`}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-900 px-1">กลุ่มสาระ</label>
                        <select 
                          className="w-full px-2 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-[10px] font-bold h-9 cursor-pointer hover:border-amber-400" 
                          value={hDept} 
                          onChange={(e) => setHDept(e.target.value)}
                        >
                          <option value="ทั้งหมด">ทั้งหมด</option>
                          {historyDeptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-900 px-1">สถานะการตรวจ</label>
                        <select 
                          className="w-full px-2 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-[10px] font-bold h-9 cursor-pointer hover:border-amber-400" 
                          value={hCheckStatus} 
                          onChange={(e) => setHCheckStatus(e.target.value)}
                        >
                          <option value="ทั้งหมด">ทั้งหมด</option>
                          <option value="pending">ยังไม่ตรวจ</option>
                          <option value="checked">ตรวจแล้ว</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-900 px-1">สถานะการอนุมัติ</label>
                        <select 
                          className="w-full px-2 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-[10px] font-bold h-9 cursor-pointer hover:border-amber-400" 
                          value={hApproveStatus} 
                          onChange={(e) => setHApproveStatus(e.target.value)}
                        >
                          <option value="ทั้งหมด">ทั้งหมด</option>
                          <option value="pending">ยังไม่อนุมัติ</option>
                          <option value="approved">อนุมัติแล้ว</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => {
                            applyHistoryFilters();
                          }}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs h-9 rounded-xl shadow-lg border-b-4 border-amber-950 flex items-center justify-center gap-2 transition-all active:scale-95 active:border-b-0 active:translate-y-1"
                        >
                          <Search size={14} /> กรองข้อมูล
                        </button>
                        <button 
                          onClick={handleResetHistory}
                          className="w-10 h-9 bg-white border-2 border-amber-200 text-amber-900 rounded-xl flex items-center justify-center hover:bg-amber-100 transition-all shadow-md active:scale-95"
                          title="ล้างการกรอง"
                        >
                           <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Active Teacher Filter Pill (Sheet 2) */}
                    {hSearch !== 'ทั้งหมด' && (
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50 border-2 border-emerald-300 p-3 px-5 rounded-2xl shadow-sm">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-black text-emerald-950">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>กำลังกรองประวัติส่งแผนของครูตาม Sheet 2:</span>
                          <span className="bg-emerald-600 text-white px-3 py-1 rounded-xl text-sm shadow-sm font-black">
                            {hSearch}
                          </span>
                          {(() => {
                            const matchT = teachers.find(t => t.fullName === hSearch);
                            return matchT ? (
                              <span className="text-emerald-800 bg-white/90 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                กลุ่มสาระฯ {matchT.department} ({matchT.position || 'ครู'}) • ลำดับที่ {matchT.no}
                              </span>
                            ) : null;
                          })()}
                          <span className="text-emerald-800/80">
                            (พบ {historyList.length} รายการ)
                          </span>
                        </div>
                        <button
                          onClick={() => setHSearch('ทั้งหมด')}
                          className="text-xs font-black text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1"
                        >
                          <span>✕ แสดงครูทุกคน</span>
                        </button>
                      </div>
                    )}

                    {renderPlanList('all')}
                 </motion.section>
               )}

               {activeTab === 'admin' && (
                 <motion.section 
                    key="admin"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-8"
                 >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-[16px] border-gray-600 pl-8 h-auto py-2">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gray-700 text-white rounded-2xl flex items-center justify-center shadow-lg">
                          <Settings size={34} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-3xl md:text-5xl font-black text-amber-950">จัดการระบบและข้อมูล (ผู้ดูแลระบบ)</h2>
                            <span className="bg-gray-800 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm">
                              Admin
                            </span>
                          </div>
                          <p className="text-sm font-bold text-amber-800/80 mt-1">
                            ค้นหา ตรวจสอบ พิมพ์ใบรับรอง และลบข้อมูลการส่งแผนการสอน สามารถกรองตามปีการศึกษา ภาคเรียน และกลุ่มสาระการเรียนรู้
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-amber-100 text-amber-950 px-4 py-2 rounded-2xl border-2 border-amber-300 font-black text-sm shadow-sm flex items-center gap-2">
                          <FileText size={16} className="text-amber-800" />
                          <span>พบ {adminFilteredPlans.length} / {plans.length} รายการ</span>
                        </div>
                      </div>
                    </div>

                    {/* Admin Filter Bar (กรองข้อมูลตามปีการศึกษา ภาคเรียน กลุ่มสาระ ครูผู้สอน) */}
                    <div className="bg-amber-50/90 p-6 rounded-3xl border-2 border-amber-200 shadow-md space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-amber-200/80">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
                          <span className="text-xs md:text-sm font-black text-amber-950 uppercase tracking-wider flex items-center gap-2">
                            <Search size={16} className="text-amber-600" />
                            ตัวกรองข้อมูลระบบผู้ดูแล
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAdminYear(CONFIG.CURRENT_YEAR);
                              setAdminTerm(CONFIG.CURRENT_SEMESTER);
                              setAdminDept('ทั้งหมด');
                              setAdminTeacher('ทั้งหมด');
                              setAdminStatus('ทั้งหมด');
                              setAdminSearch('');
                            }}
                            className="text-xs font-black text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                          >
                            <Calendar size={13} className="text-amber-700" />
                            <span>ปี/ภาคเรียนปัจจุบัน ({CONFIG.CURRENT_SEMESTER}/{CONFIG.CURRENT_YEAR})</span>
                          </button>
                          {(adminYear !== 'ทั้งหมด' || adminTerm !== 'ทั้งหมด' || adminDept !== 'ทั้งหมด' || adminTeacher !== 'ทั้งหมด' || adminSearch || adminStatus !== 'ทั้งหมด') && (
                            <button
                              type="button"
                              onClick={handleResetAdminFilters}
                              className="text-xs font-black text-rose-700 hover:text-rose-900 bg-white hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1"
                            >
                              <Trash2 size={13} />
                              <span>ล้างการกรอง</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                        {/* 1. ปีการศึกษา */}
                        <div className="space-y-1">
                          <label className="text-xs font-black text-amber-900 px-1 flex items-center gap-1.5">
                            <Calendar size={14} className="text-amber-600" />
                            <span>ปีการศึกษา</span>
                          </label>
                          <select 
                            className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-black h-10 cursor-pointer hover:border-amber-400 shadow-sm" 
                            value={adminYear} 
                            onChange={(e) => setAdminYear(e.target.value)}
                          >
                            <option value="ทั้งหมด">ทั้งหมด (ทุกปี)</option>
                            {allYearOptions.map(y => (
                              <option key={y} value={y}>
                                ปี {y} {y === CONFIG.CURRENT_YEAR ? '★ ปัจจุบัน' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 2. ภาคเรียน */}
                        <div className="space-y-1">
                          <label className="text-xs font-black text-amber-900 px-1 flex items-center gap-1.5">
                            <Layers size={14} className="text-amber-600" />
                            <span>ภาคเรียน</span>
                          </label>
                          <select 
                            className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-black h-10 cursor-pointer hover:border-amber-400 shadow-sm" 
                            value={adminTerm} 
                            onChange={(e) => setAdminTerm(e.target.value)}
                          >
                            <option value="ทั้งหมด">ทั้งหมด (ทุกเทอม)</option>
                            {CONFIG.SEMESTERS.map(s => (
                              <option key={s} value={s}>
                                ภาคเรียนที่ {s} {s === CONFIG.CURRENT_SEMESTER && adminYear === CONFIG.CURRENT_YEAR ? '★ ปัจจุบัน' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 3. กลุ่มสาระการเรียนรู้ */}
                        <div className="space-y-1">
                          <label className="text-xs font-black text-amber-900 px-1 flex items-center gap-1.5">
                            <BookOpen size={14} className="text-amber-600" />
                            <span>กลุ่มสาระการเรียนรู้</span>
                          </label>
                          <select 
                            className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-black h-10 cursor-pointer hover:border-amber-400 shadow-sm" 
                            value={adminDept} 
                            onChange={(e) => {
                              setAdminDept(e.target.value);
                              setAdminTeacher('ทั้งหมด');
                            }}
                          >
                            <option value="ทั้งหมด">ทั้งหมด (ทุกกลุ่มสาระฯ)</option>
                            {standardDeptOptions.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>

                        {/* 4. ครูตาม Sheet 2 */}
                        <div className="space-y-1">
                          <label className="text-xs font-black text-amber-900 px-1 flex items-center gap-1.5">
                            <Users size={14} className="text-amber-600" />
                            <span>ครูผู้สอน (Sheet 2)</span>
                          </label>
                          <select
                            className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-black h-10 cursor-pointer hover:border-amber-400 shadow-sm"
                            value={adminTeacher}
                            onChange={(e) => setAdminTeacher(e.target.value)}
                          >
                            <option value="ทั้งหมด">ครูทุกคน ({adminTeachersInDept.length} คน)</option>
                            {adminTeachersInDept.map(t => (
                              <option key={t.no || t.fullName} value={t.fullName}>
                                #{t.no} {t.fullName} ({t.department})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 5. ค้นหาชื่อครู/วิชา */}
                        <div className="space-y-1">
                          <label className="text-xs font-black text-amber-900 px-1 flex items-center gap-1.5">
                            <Search size={14} className="text-amber-600" />
                            <span>ค้นหาคำ / รหัสวิชา</span>
                          </label>
                          <div className="relative">
                            <input 
                              type="text"
                              placeholder="พิมพ์ค้นหา..."
                              value={adminSearch}
                              onChange={(e) => setAdminSearch(e.target.value)}
                              className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-bold h-10 shadow-sm pr-7"
                            />
                            {adminSearch && (
                              <button
                                type="button"
                                onClick={() => setAdminSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 6. สถานะ */}
                        <div className="space-y-1">
                          <label className="text-xs font-black text-amber-900 px-1 flex items-center gap-1.5">
                            <CheckSquare size={14} className="text-amber-600" />
                            <span>สถานะการตรวจ/อนุมัติ</span>
                          </label>
                          <select 
                            className="w-full px-3 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-xs font-black h-10 cursor-pointer hover:border-amber-400 shadow-sm" 
                            value={adminStatus} 
                            onChange={(e) => setAdminStatus(e.target.value)}
                          >
                            <option value="ทั้งหมด">ทั้งหมด (ทุกสถานะ)</option>
                            <option value="pending">รอรับการตรวจ</option>
                            <option value="checked">ผ่านการตรวจแล้ว</option>
                            <option value="approved">อนุมัติแล้ว</option>
                          </select>
                        </div>
                      </div>

                      {/* Quick Department Filter Pills */}
                      <div className="pt-2 border-t border-amber-200/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-black text-amber-900/80 flex items-center gap-1.5">
                            <BookOpen size={13} className="text-amber-700" />
                            <span>คลิกเลือกกลุ่มสาระฯ แบบด่วน (แสดงจำนวนแผนการสอนตามปี {adminYear === 'ทั้งหมด' ? 'ทุกปี' : adminYear} / เทอม {adminTerm === 'ทั้งหมด' ? 'ทุกเทอม' : adminTerm}):</span>
                          </div>
                          {adminDept !== 'ทั้งหมด' && (
                            <button
                              type="button"
                              onClick={() => {
                                setAdminDept('ทั้งหมด');
                                setAdminTeacher('ทั้งหมด');
                              }}
                              className="text-[11px] font-black text-amber-700 hover:text-amber-950 underline"
                            >
                              แสดงทุกกลุ่มสาระฯ
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAdminDept('ทั้งหมด');
                              setAdminTeacher('ทั้งหมด');
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                              adminDept === 'ทั้งหมด'
                                ? 'bg-amber-950 text-white shadow-md ring-2 ring-amber-500'
                                : 'bg-white hover:bg-amber-100 text-amber-950 border border-amber-300'
                            }`}
                          >
                            ทั้งหมด ({plans.filter(p => isMatchYear(p.year, adminYear) && isMatchTerm(p.semester, adminTerm)).length})
                          </button>
                          {standardDeptOptions.map(dept => {
                            const count = plans.filter(p =>
                              isMatchYear(p.year, adminYear) &&
                              isMatchTerm(p.semester, adminTerm) &&
                              isMatchDept(p.department, dept, p.userName)
                            ).length;
                            const isSelected = adminDept === dept;
                            return (
                              <button
                                key={dept}
                                type="button"
                                onClick={() => {
                                  setAdminDept(dept);
                                  setAdminTeacher('ทั้งหมด');
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400'
                                    : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                              >
                                <span>{dept}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                  isSelected ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Active Filters Summary Chips */}
                      {(adminYear !== 'ทั้งหมด' || adminTerm !== 'ทั้งหมด' || adminDept !== 'ทั้งหมด' || adminTeacher !== 'ทั้งหมด' || adminStatus !== 'ทั้งหมด' || adminSearch) && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs font-black text-amber-900 border-t border-amber-200/70">
                          <span className="text-amber-700/80 font-bold">เงื่อนไขที่เลือก:</span>
                          {adminYear !== 'ทั้งหมด' && (
                            <span className="bg-amber-200 text-amber-950 px-2.5 py-0.5 rounded-lg border border-amber-300">
                              ปี {adminYear}
                            </span>
                          )}
                          {adminTerm !== 'ทั้งหมด' && (
                            <span className="bg-amber-200 text-amber-950 px-2.5 py-0.5 rounded-lg border border-amber-300">
                              ภาคเรียนที่ {adminTerm}
                            </span>
                          )}
                          {adminDept !== 'ทั้งหมด' && (
                            <span className="bg-amber-200 text-amber-950 px-2.5 py-0.5 rounded-lg border border-amber-300">
                              กลุ่มสาระฯ {adminDept}
                            </span>
                          )}
                          {adminTeacher !== 'ทั้งหมด' && (
                            <span className="bg-emerald-200 text-emerald-950 px-2.5 py-0.5 rounded-lg border border-emerald-300">
                              ครู: {adminTeacher}
                            </span>
                          )}
                          {adminStatus !== 'ทั้งหมด' && (
                            <span className="bg-amber-200 text-amber-950 px-2.5 py-0.5 rounded-lg border border-amber-300">
                              สถานะ: {adminStatus === 'approved' ? 'อนุมัติแล้ว' : adminStatus === 'checked' ? 'ผ่านการตรวจ' : 'รอรับการตรวจ'}
                            </span>
                          )}
                          {adminSearch && (
                            <span className="bg-amber-200 text-amber-950 px-2.5 py-0.5 rounded-lg border border-amber-300">
                              ค้นหา: "{adminSearch}"
                            </span>
                          )}
                          <span className="text-emerald-700 font-black ml-auto">
                            แสดงผล {adminFilteredPlans.length} รายการ
                          </span>
                        </div>
                      )}
                    </div>

                    {renderAdminTable()}
                 </motion.section>
               )}
             </AnimatePresence>
           )}
        </div>

        {/* Footer (Inside the sheet) */}
        <footer className="bg-amber-950 text-amber-100 p-12 border-t-4 border-amber-500 flex flex-col items-center gap-8">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 text-center">
            <div className="space-y-1">
              <p className="text-sm md:text-base font-medium opacity-100">
                พัฒนาโดย ครูชมัยพร ถิ่นสำราญ
              </p>
            </div>
            
            <div className="space-y-1 opacity-90">
              <p className="text-sm md:text-base font-medium">
                 ครูชำนาญการพิเศษ กลุ่มบริหารงานวิชาการ
              </p>
              <p className="text-sm md:text-base font-bold uppercase tracking-[0.2em] text-amber-500">
                 โรงเรียนท่าบ่อ สพม.หนองคาย
              </p>
            </div>

            <div className="mt-6 opacity-40 bg-white/5 px-6 py-2 rounded-full border border-white/10 font-medium text-xs md:text-sm italic text-center">
              © 2026 ระบบส่งแผนการจัดการเรียนรู้ออนไลน์ • ออกแบบอย่างมืออาชีพ
            </div>
          </div>
        </footer>
      </div>
    </div>
  );

  function renderCheckTable(forcedStatus?: string) {
    const list = plans.filter(p => {
      const matchSearch = !checkSearch.trim() || 
        String(p.userName || '').toLowerCase().includes(checkSearch.toLowerCase()) ||
        isNamesFuzzyMatch(String(p.userName || ''), checkSearch) ||
        String(p.subjectId || '').toLowerCase().includes(checkSearch.toLowerCase());
      const matchYear = isMatchYear(p.year, checkYear);
      const matchTerm = isMatchTerm(p.semester, checkTerm);
      const matchDept = isMatchDept(p.department, checkDept, p.userName);
      const matchStatus = forcedStatus ? p.status === forcedStatus : (checkStatus === 'ทั้งหมด' || String(p.status) === String(checkStatus));
      return matchSearch && matchYear && matchTerm && matchDept && matchStatus;
    });

    return (
      <div className="bg-white rounded-3xl border-2 border-amber-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-amber-950 text-white">
                <th className="p-5 font-black text-sm uppercase tracking-wider text-center border-r border-white/10">ที่</th>
                <th className="p-5 font-black text-sm uppercase tracking-wider border-r border-white/10">ชื่อ - สกุล</th>
                <th className="p-5 font-black text-sm uppercase tracking-wider text-center border-r border-white/10">รหัสวิชา</th>
                <th className="p-5 font-black text-sm uppercase tracking-wider border-r border-white/10">ชื่อวิชา</th>
                <th className="p-5 font-black text-sm uppercase tracking-wider text-center border-r border-white/10">ระดับชั้น</th>
                <th className="p-5 font-black text-sm uppercase tracking-wider text-center border-r border-white/10">ไฟล์แผนการสอน</th>
                <th className="p-5 font-black text-sm uppercase tracking-wider text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {list.length > 0 ? list.map((plan, idx) => (
                <tr key={plan.id || `check-plan-${idx}-${plan.userName}-${plan.subjectId}`} className="border-b border-amber-50 hover:bg-amber-50/50 transition-colors">
                  <td className="p-4 text-center font-bold text-amber-900 border-r border-amber-50">{idx + 1}</td>
                  <td className="p-4 font-black text-amber-950 border-r border-amber-50">
                    <div className="flex flex-col">
                      <span>{plan.userName}</span>
                      <span className="text-[10px] text-amber-700 font-bold">กลุ่มสาระฯ {normalizeDepartment(plan.department)}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center font-bold text-amber-600 border-r border-amber-50">{plan.subjectId}</td>
                  <td className="p-4 font-medium text-amber-900 border-r border-amber-50">{plan.subjectName}</td>
                  <td className="p-4 text-center font-bold text-amber-900 border-r border-amber-50">{plan.level}</td>
                  <td className="p-4 text-center border-r border-amber-50">
                    <a 
                      href={plan.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-amber-100 text-amber-900 px-4 py-2 rounded-xl font-black text-xs hover:bg-amber-200 transition-all border-2 border-amber-200"
                    >
                      <Download size={14} /> ดูไฟล์
                    </a>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      {plan.status === 'pending' && activeTab === 'check' && (
                        <button 
                          onClick={() => {
                            Swal.fire({
                              title: 'ยืนยันการตรวจแผน',
                              text: `คุณ (${sessionUser.name}) ต้องการลงนามตรวจแผนการจัดการเรียนรู้นี้ใช่หรือไม่?`,
                              icon: 'question',
                              showCancelButton: true,
                              confirmButtonText: 'ใช่, ลงนามผ่าน',
                              cancelButtonText: 'ยกเลิก',
                              confirmButtonColor: '#059669'
                            }).then((result) => {
                              if (result.isConfirmed) {
                                handleAction(plan.id, 'check', { checkerName: sessionUser.name, checkerPosition: sessionUser.position });
                              }
                            });
                          }}
                          className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-green-700 shadow-md transition-all active:scale-95"
                        >
                          ลงนามผ่าน
                        </button>
                      )}
                      {plan.status === 'checked' && activeTab === 'approve' && (
                        <button 
                          onClick={() => {
                            Swal.fire({
                              title: 'ยืนยันการอนุมัติแผน',
                              text: `คุณ (${sessionUser.name}) ต้องการลงนามอนุมัติแผนการจัดการเรียนรู้นี้ใช่หรือไม่?`,
                              icon: 'question',
                              showCancelButton: true,
                              confirmButtonText: 'ใช่, อนุมัติแผน',
                              cancelButtonText: 'ยกเลิก',
                              confirmButtonColor: '#2563EB'
                            }).then((result) => {
                              if (result.isConfirmed) {
                                handleAction(plan.id, 'approve', { approverName: sessionUser.name, approverPosition: sessionUser.position });
                              }
                            });
                          }}
                          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 shadow-md transition-all active:scale-95"
                        >
                          อนุมัติแผน
                        </button>
                      )}
                      {plan.status === 'approved' && (
                        <span className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full">อนุมัติแล้ว</span>
                      )}
                      {plan.status === 'checked' && activeTab === 'check' && (
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-3 py-1 rounded-full">ตรวจแล้ว</span>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="p-20 text-center text-amber-300 italic font-medium">
                    <Search className="mx-auto mb-4 opacity-20" size={48} />
                    ไม่พบรายการที่รอการดำเนินการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderAdminTable() {
    return (
      <div className="bg-white rounded-[32px] border-4 border-amber-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-amber-950 text-white border-b-4 border-amber-500">
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center border-r border-white/10 w-16">ที่</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider border-r border-white/10">ครูผู้สอน / กลุ่มสาระ</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider border-r border-white/10">รายวิชา / ระดับชั้น</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center border-r border-white/10 w-28">ปี/ภาคเรียน</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center border-r border-white/10 w-32">ลิงก์ไฟล์</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center border-r border-white/10 w-36">สถานะการตรวจ</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center w-36">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-amber-50">
              {adminFilteredPlans.length > 0 ? adminFilteredPlans.map((plan, idx) => (
                <tr key={plan.id || `admin-plan-${idx}-${plan.userName}-${plan.subjectId}`} className="hover:bg-amber-50 transition-colors">
                  <td className="p-4 text-center font-black text-amber-900/40 text-sm italic">{idx + 1}</td>
                  <td className="p-4">
                    <div className="font-black text-amber-950 text-base">{plan.userName}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[11px] font-black text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-lg border border-amber-300 shadow-xs">
                        กลุ่มสาระฯ {normalizeDepartment(plan.department)}
                      </span>
                      {(() => {
                        const t = teachers.find(teach => isNamesFuzzyMatch(teach.fullName, plan.userName));
                        return t ? (
                          <span className="text-[10px] font-bold text-amber-900/70 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            Sheet 2 #{t.no} ({t.position || 'ครู'})
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-amber-900 text-sm leading-tight">{plan.subjectId} {plan.subjectName}</div>
                    <div className="text-[10px] font-black opacity-40 mt-1">ระดับชั้น{plan.level}</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="font-black text-amber-950 text-sm">
                      {plan.year}/{plan.semester}
                    </div>
                    {String(plan.year) === CONFIG.CURRENT_YEAR && String(plan.semester) === CONFIG.CURRENT_SEMESTER ? (
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full inline-block mt-0.5 border border-emerald-300">
                        เทอมปัจจุบัน
                      </span>
                    ) : null}
                  </td>
                  <td className="p-4 text-center">
                    <a 
                      href={plan.fileUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-xl font-black text-xs hover:bg-amber-950 hover:text-white transition-all shadow-sm border border-amber-200"
                    >
                      <FileText size={13} /> เปิดดูแผน
                    </a>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-[10px] px-3 py-1 rounded-full font-black ${
                        plan.status === 'approved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                        plan.status === 'checked' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 
                        'bg-orange-100 text-orange-700 border border-orange-200'
                      }`}>
                        {plan.status === 'approved' ? '✓ อนุมัติแล้ว' : 
                         plan.status === 'checked' ? '✓ ผ่านการตรวจ' : '⏳ รอรับการตรวจ'}
                      </span>
                      <div className="text-[9px] font-bold text-amber-900/40">{plan.timestamp.split(' ')[0]}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => printDocument(plan)}
                        className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center hover:bg-amber-950 hover:text-white transition-all shadow-sm active:scale-95"
                        title="พิมพ์ใบรับรอง"
                      >
                        <Printer size={16} />
                      </button>
                      <button 
                        onClick={() => handleAction(plan.id, 'delete')}
                        className="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
                        title="ลบรายการ"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-1">
                        <Search size={32} />
                      </div>
                      <p className="font-black text-xl text-amber-950">
                        ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                      </p>
                      <p className="text-xs font-bold text-amber-800/70 max-w-md mx-auto">
                        เงื่อนไข: ปี ({adminYear}) | ภาคเรียน ({adminTerm}) | กลุ่มสาระฯ ({adminDept}) {adminTeacher !== 'ทั้งหมด' ? `| ครู (${adminTeacher})` : ''} {adminSearch ? `| ค้นหา "${adminSearch}"` : ''}
                      </p>
                      <button
                        onClick={handleResetAdminFilters}
                        className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
                      >
                        ล้างตัวกรองทั้งหมด
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderPlanList(mode: 'pending' | 'checked' | 'all' | 'admin') {
    let list: LessonPlan[] = [];
    
    if (mode === 'all' || mode === 'admin') {
      list = historyList;
      if (mode === 'admin') {
         // Optionally sort or filter more for admin? 
         // For now let's keep it same but maybe admin sees everything unfiltered by default?
         // Use plans for admin if we want them to see EVERYTHING regardless of filters
         list = historyList; 
      }
    } else {
      list = filteredPlans.filter(p => p.status === mode);
    }

    if (mode === 'all' || mode === 'admin') {
      return (
        <div className="bg-white rounded-[32px] border-4 border-amber-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-amber-950 text-white border-b-4 border-amber-500">
                  <th className="p-4 font-black text-xs uppercase tracking-wider text-center border-r border-white/10 w-16">ที่</th>
                  <th className="p-4 font-black text-xs uppercase tracking-wider border-r border-white/10">ครูผู้สอน / กลุ่มสาระ</th>
                  <th className="p-4 font-black text-xs uppercase tracking-wider border-r border-white/10">รายวิชา / ระดับชั้น</th>
                  <th className="p-4 font-black text-xs uppercase tracking-wider text-center border-r border-white/10 w-24">ปี/เทอม</th>
                  {mode !== 'all' && <th className="p-4 font-black text-xs uppercase tracking-wider text-center border-r border-white/10 w-32">ลิงก์แผน</th>}
                  <th className="p-4 font-black text-xs uppercase tracking-wider text-center border-r border-white/10 w-32">สถานะ</th>
                  <th className="p-4 font-black text-xs uppercase tracking-wider text-center w-32">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-amber-50">
                {list.length > 0 ? list.map((plan, idx) => (
                  <tr key={plan.id || `history-plan-${idx}-${plan.userName}-${plan.subjectId}`} className="hover:bg-amber-50 transition-colors">
                    <td className="p-4 text-center font-black text-amber-900/40 text-sm italic">{idx + 1}</td>
                    <td className="p-4">
                      <div className="font-black text-amber-950 text-base">{plan.userName}</div>
                      <div className="text-[10px] font-black text-amber-700 bg-amber-100/70 inline-block px-2 py-0.5 rounded-md mt-1 border border-amber-200">
                        กลุ่มสาระฯ {normalizeDepartment(plan.department)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-amber-900 text-sm leading-tight">{plan.subjectId} {plan.subjectName}</div>
                      <div className="text-[10px] font-black opacity-40 mt-1">ระดับชั้น{plan.level}</div>
                    </td>
                    <td className="p-4 text-center font-black text-amber-950 text-sm">
                      {plan.year}/{plan.semester}
                    </td>
                    {mode !== 'all' && (
                      <td className="p-4 text-center">
                        <a 
                          href={plan.fileUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg font-black text-[10px] hover:bg-amber-950 hover:text-white transition-all shadow-sm border border-amber-200"
                        >
                          <FileText size={12} /> เปิดดูแผน
                        </a>
                      </td>
                    )}
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-[9px] px-3 py-0.5 rounded-full font-black uppercase tracking-tighter ${
                          plan.status === 'approved' ? 'bg-green-100 text-green-700' : 
                          plan.status === 'checked' ? 'bg-blue-100 text-blue-700' : 
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {plan.status === 'approved' ? 'อนุมัติแล้ว' : 
                           plan.status === 'checked' ? 'ผ่านการตรวจ' : 'รอรับการตรวจ'}
                        </span>
                        <div className="text-[8px] font-bold text-amber-900/30 italic">{plan.timestamp.split(' ')[0]}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => printDocument(plan)}
                          className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center hover:bg-amber-950 hover:text-white transition-all shadow-sm"
                          title="พิมพ์ใบรับรอง"
                        >
                          <Printer size={16} />
                        </button>
                        {mode === 'admin' && (
                          <button 
                            onClick={() => handleAction(plan.id, 'delete')}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-100 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                            title="ลบรายการ"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={mode === 'all' ? 6 : 7} className="p-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-1">
                          <Search size={32} />
                        </div>
                        <p className="font-black text-xl text-amber-950">
                          {hSearch !== 'ทั้งหมด' ? `ไม่พบประวัติการส่งแผนของ "${hSearch}"` : 'ไม่พบข้อมูลที่ค้นหา'}
                        </p>
                        <p className="text-xs font-bold text-amber-800/70 max-w-md mx-auto">
                          {hSearch !== 'ทั้งหมด'
                            ? `สำหรับปีการศึกษา ${hYear === 'ทั้งหมด' ? 'ทุกปี' : hYear} ภาคเรียนที่ ${hTerm === 'ทั้งหมด' ? 'ทุกเทอม' : hTerm} ${hDept !== 'ทั้งหมด' ? `(กลุ่มสาระฯ ${hDept})` : ''} ยังไม่มีบันทึกส่งแผนการสอน สามารถเปลี่ยนปีหรือภาคเรียนเป็น "ทั้งหมด" เพื่อดูประวัติย้อนหลัง`
                            : 'ลองเปลี่ยนเงื่อนไขการค้นหา เช่น เลือกปีการศึกษา หรือภาคเรียนเป็น "ทั้งหมด"'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {list.length > 0 ? list.map((plan) => (
          <motion.div 
            whileHover={{ y: -10, scale: 1.02 }}
            key={plan.id} 
            className="minimal-card flex flex-col gap-8 relative overflow-hidden bg-white border-[6px] border-amber-50 p-10 shadow-xl hover:border-amber-400"
          >
            <div className={`absolute top-0 left-0 h-4 w-full ${
              plan.status === 'approved' ? 'bg-green-500' : 
              plan.status === 'checked' ? 'bg-blue-500' : 'bg-orange-500'
            }`} />

            <div className="flex justify-between items-center">
              <span className="bg-amber-100 px-4 py-1.5 rounded-xl text-sm font-black text-amber-900 border-2 border-amber-200">
                #รหัส-{plan.id.substring(plan.id.length - 4)}
              </span>
              <span className={`text-base px-6 py-2 rounded-full font-black uppercase tracking-tighter ${
                plan.status === 'approved' ? 'bg-green-100 text-green-700' : 
                plan.status === 'checked' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {plan.status === 'approved' ? 'อนุมัติแล้ว' : plan.status === 'checked' ? 'ผ่านการตรวจ' : 'รอรับการตรวจ'}
              </span>
            </div>

            <div className="space-y-3">
              <h3 className="font-black text-amber-950 text-2xl leading-tight">
                {plan.subjectId}: {plan.subjectName}
              </h3>
              <p className="text-xl text-amber-700 font-extrabold opacity-80 decoration-[4px] underline underline-offset-[10px] decoration-amber-100">
                {plan.userName}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 text-lg text-amber-900 font-black pt-4">
              <div className="flex items-center gap-4 bg-amber-50 p-4 rounded-2xl border-2 border-amber-100 shadow-sm leading-none"><Calendar size={24} /> ปี {plan.year} เทอม {plan.semester}</div>
              <div className="flex items-center gap-4 bg-white border-2 border-amber-50 p-4 rounded-2xl shadow-inner leading-none"><Layers size={24} /> ระดับชั้น {plan.level}</div>
              <div className="flex items-center gap-4 opacity-40 px-4 italic text-sm"><History size={20} /> ส่งเมื่อ: {plan.timestamp}</div>
            </div>

            <div className="pt-8 border-t-4 border-amber-50 flex flex-wrap gap-4 mt-auto">
              <a 
                href={plan.fileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-amber-600 text-white p-5 rounded-2xl hover:bg-amber-700 transition-all flex items-center justify-center flex-1 font-black text-xl shadow-lg border-b-4 border-amber-900"
                title="เปิดไฟล์"
              >
                <FileText size={28} className="mr-2" /> เปิดไฟล์
              </a>

              {(mode === 'pending') && (
                <button 
                  onClick={async () => {
                    const { value: formValues } = await Swal.fire({
                      title: <span className="font-black text-amber-950">ข้อมูลการตรวจแผน</span>,
                      html: `
                        <div class="space-y-4 p-2 text-left">
                          <div>
                            <label class="block text-xs font-black text-amber-900 mb-1">รหัสผ่านสำหรับผู้ตรวจ</label>
                            <input id="swal-pass-card" type="password" class="swal2-input !m-0 !w-full" placeholder="ระบุรหัสผ่าน">
                          </div>
                          <div>
                            <label class="block text-xs font-black text-amber-900 mb-1">ชื่อ-นามสกุล ผู้ตรวจ</label>
                            <input id="swal-name-card" class="swal2-input !m-0 !w-full" placeholder="ระบุชื่อ-นามสกุล">
                          </div>
                          <div>
                            <label class="block text-xs font-black text-amber-900 mb-1">ตำแหน่ง</label>
                            <input id="swal-pos-card" class="swal2-input !m-0 !w-full" placeholder="ระบุตำแหน่ง">
                          </div>
                        </div>
                      `,
                      focusConfirm: false,
                      showCancelButton: true,
                      confirmButtonText: 'ลงนามตรวจ',
                      cancelButtonText: 'ยกเลิก',
                      preConfirm: () => {
                        const pass = (document.getElementById('swal-pass-card') as HTMLInputElement).value;
                        const name = (document.getElementById('swal-name-card') as HTMLInputElement).value;
                        const pos = (document.getElementById('swal-pos-card') as HTMLInputElement).value;

                        if (pass !== 'thabo001') {
                          Swal.showValidationMessage('รหัสผ่านผู้ตรวจไม่ถูกต้อง');
                          return false;
                        }
                        if (!name || !pos) {
                          Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                          return false;
                        }
                        return { checkerName: name, checkerPosition: pos };
                      }
                    });
                    if (formValues) handleAction(plan.id, 'check', formValues);
                  }}
                  className="btn-primary py-5 px-6 text-lg flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  ลงนามตรวจ
                </button>
              )}

              {(mode === 'checked') && (
                <button 
                  onClick={async () => {
                    const { value: formValues } = await Swal.fire({
                      title: <span className="font-black text-amber-950">ข้อมูลการอนุมัติแผน</span>,
                      html: `
                        <div class="space-y-4 p-2 text-left">
                          <div>
                            <label class="block text-xs font-black text-amber-900 mb-1">รหัสผ่านสำหรับผู้อนุมัติ</label>
                            <input id="swal-apprv-pass" type="password" class="swal2-input !m-0 !w-full" placeholder="ระบุรหัสผ่าน">
                          </div>
                          <div>
                            <label class="block text-xs font-black text-amber-900 mb-1">ชื่อ-นามสกุล ผู้อนุมัติ</label>
                            <input id="swal-apprv-name" class="swal2-input !m-0 !w-full" placeholder="ระบุชื่อ-นามสกุล">
                          </div>
                          <div>
                            <label class="block text-xs font-black text-amber-900 mb-1">ตำแหน่ง</label>
                            <input id="swal-apprv-pos" class="swal2-input !m-0 !w-full" placeholder="ระบุตำแหน่ง">
                          </div>
                        </div>
                      `,
                      focusConfirm: false,
                      showCancelButton: true,
                      confirmButtonText: 'อนุมัติแผน',
                      cancelButtonText: 'ยกเลิก',
                      preConfirm: () => {
                        const pass = (document.getElementById('swal-apprv-pass') as HTMLInputElement).value;
                        const name = (document.getElementById('swal-apprv-name') as HTMLInputElement).value;
                        const pos = (document.getElementById('swal-apprv-pos') as HTMLInputElement).value;

                        if (pass !== 'direct01') {
                          Swal.showValidationMessage('รหัสผ่านผู้อนุมัติไม่ถูกต้อง');
                          return false;
                        }
                        if (!name || !pos) {
                          Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                          return false;
                        }
                        return { approverName: name, approverPosition: pos };
                      }
                    });
                    if (formValues) handleAction(plan.id, 'approve', formValues);
                  }}
                  className="btn-primary py-5 px-6 text-lg flex-1 bg-blue-700 hover:bg-blue-800 text-white"
                >
                  อนุมัติแผน
                </button>
              )}
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full py-40 flex flex-col items-center gap-6 opacity-30">
            <Search size={100} />
            <p className="text-3xl font-black text-amber-950 uppercase tracking-widest italic">ยังไม่มีข้อมูลในส่วนนี้</p>
          </div>
        )}
      </div>
    );
  }
}

