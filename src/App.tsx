/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  FileDown
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
  Cell 
} from 'recharts';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { CONFIG } from './constants';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Checker/Approver session info
  const [sessionUser, setSessionUser] = useState({ name: '', position: '' });

  // Check Section Filters
  const [checkSearch, setCheckSearch] = useState('');
  const [checkYear, setCheckYear] = useState('2567');
  const [checkTerm, setCheckTerm] = useState('2');
  const [checkDept, setCheckDept] = useState('ทั้งหมด');
  const [checkStatus, setCheckStatus] = useState('pending');

  // Dashbaord Filters
  const [yearFilter, setYearFilter] = useState('ทั้งหมด');
  const [termFilter, setTermFilter] = useState('ทั้งหมด');
  const [deptFilter, setDeptFilter] = useState('ทั้งหมด');

  // History Filters
  const [hSearch, setHSearch] = useState('ทั้งหมด');
  const [hYear, setHYear] = useState('ทั้งหมด');
  const [hTerm, setHTerm] = useState('ทั้งหมด');
  const [hDept, setHDept] = useState('ทั้งหมด');
  const [hCheckStatus, setHCheckStatus] = useState('ทั้งหมด');
  const [hApproveStatus, setHApproveStatus] = useState('ทั้งหมด');
  const [historyList, setHistoryList] = useState<LessonPlan[]>([]);

  const uniqueHNames = Array.from(new Set(plans.map(p => p.userName?.trim()))).filter(Boolean).sort();
  const uniqueHYears = Array.from(new Set(plans.map(p => String(p.year)))).filter(y => y && y !== 'undefined' && y !== 'null').sort();
  const uniqueHTerms = Array.from(new Set(plans.map(p => String(p.semester)))).filter(t => t && t !== 'undefined' && t !== 'null').sort();
  const uniqueHDepts = Array.from(new Set(plans.map(p => p.department?.trim()))).filter(Boolean).sort();

  // Update history list reactively or on button click
  // User asked for a search button, but also wants selection to reflect accurately.
  const applyHistoryFilters = () => {
    const list = plans.filter(p => {
      const matchSearch = hSearch === 'ทั้งหมด' || String(p.userName || '').trim().toLowerCase() === hSearch.trim().toLowerCase();
      const matchYear = hYear === 'ทั้งหมด' || String(p.year) === String(hYear);
      const matchTerm = hTerm === 'ทั้งหมด' || String(p.semester) === String(hTerm);
      const matchDept = hDept === 'ทั้งหมด' || String(p.department || '').trim() === hDept.trim();
      
      let matchCheck = true;
      if (hCheckStatus === 'checked') matchCheck = p.status === 'checked' || p.status === 'approved';
      if (hCheckStatus === 'pending') matchCheck = p.status === 'pending';

      let matchApprove = true;
      if (hApproveStatus === 'approved') matchApprove = p.status === 'approved';
      if (hApproveStatus === 'pending') matchApprove = p.status === 'pending' || p.status === 'checked';

      return matchSearch && matchYear && matchTerm && matchDept && matchCheck && matchApprove;
    });
    setHistoryList(list);
  };

  useEffect(() => {
    applyHistoryFilters();
  }, [plans]); // Re-filter when data changes

  const handleResetHistory = () => {
    setHSearch('ทั้งหมด');
    setHYear('ทั้งหมด');
    setHTerm('ทั้งหมด');
    setHDept('ทั้งหมด');
    setHCheckStatus('ทั้งหมด');
    setHApproveStatus('ทั้งหมด');
    setHistoryList(plans);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${CONFIG.SCRIPT_URL}?action=getData`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setPlans(data || []);
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

  const chartData = CONFIG.DEPARTMENTS
    .filter(dept => deptFilter === 'ทั้งหมด' || dept === deptFilter)
    .map(dept => ({
    name: dept.length > 10 ? dept.substring(0, 10) + '...' : dept,
    fullname: dept,
    count: filteredPlans.filter(p => p.department === dept).length
  }));

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
                    <div className="flex items-center gap-6 border-l-[12px] border-amber-500 pl-8 h-12 md:h-14">
                      <BarChart3 size={40} className="text-amber-600" />
                      <h2 className="text-3xl md:text-4xl font-black text-amber-950 leading-none">รายงานข้อมูลการส่งแผน</h2>
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { label: 'ส่งแผนทั้งหมด', value: stats.total, color: 'bg-yellow-200', icon: FileText },
                        { label: 'ผ่านการตรวจ', value: stats.checked, color: 'bg-blue-200', icon: CheckSquare },
                        { label: 'อนุมัติแล้ว', value: stats.approved, color: 'bg-green-200', icon: Star },
                        { label: 'รอรับการตรวจ', value: stats.pending, color: 'bg-orange-200', icon: Loader2 },
                      ].map((item, idx) => (
                        <div key={idx} className={`${item.color} p-8 rounded-[40px] border-4 border-white shadow-xl flex flex-col gap-3 hover:-translate-y-2 transition-all duration-300`}>
                          <item.icon size={32} className="text-amber-900 opacity-80" />
                          <span className="text-sm font-black text-amber-900/60 uppercase tracking-widest leading-none">{item.label}</span>
                          <span className="text-5xl font-black text-amber-950 leading-none">{item.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="minimal-card space-y-10 bg-white border-[8px] border-amber-100 p-8 md:p-12 shadow-xl">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b-4 border-amber-50">
                        <h3 className="text-2xl font-black text-amber-950">จำแนกตามกลุ่มสาระการเรียนรู้</h3>
                        <div className="flex flex-wrap gap-4">
                          <select className="bg-amber-100 text-lg font-black px-6 py-3 rounded-2xl outline-none border-2 border-amber-200" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                            {['ทั้งหมด', ...CONFIG.YEARS].map(y => <option key={y} value={y}>{y === 'ทั้งหมด' ? 'ปีการศึกษา: ทั้งหมด' : `ปีการศึกษา ${y}`}</option>)}
                          </select>
                          <select className="bg-amber-100 text-lg font-black px-6 py-3 rounded-2xl outline-none border-2 border-amber-200" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
                            {['ทั้งหมด', ...CONFIG.SEMESTERS].map(s => <option key={s} value={s}>{s === 'ทั้งหมด' ? 'ภาคเรียน: ทั้งหมด' : `ภาคเรียนที่ ${s}`}</option>)}
                          </select>
                          <select className="bg-amber-100 text-lg font-black px-6 py-3 rounded-2xl outline-none border-2 border-amber-200" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                            {['ทั้งหมด', ...CONFIG.DEPARTMENTS].map(d => <option key={d} value={d}>{d === 'ทั้งหมด' ? 'กลุ่มสาระ: ทั้งหมด' : d}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="h-[450px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#FED7AA" strokeWidth={2} />
                            <XAxis 
                              dataKey="name" 
                              angle={-45} 
                              textAnchor="end" 
                              interval={0} 
                              tick={{ fontSize: 13, fontWeight: 900, fill: '#451A03' }} 
                            />
                            <YAxis tick={{ fontSize: 13, fontWeight: 900, fill: '#451A03' }} />
                            <Tooltip 
                              cursor={{ fill: 'rgba(251, 191, 36, 0.1)' }}
                              contentStyle={{ borderRadius: '24px', border: '6px solid #FCD34D', padding: '15px' }}
                            />
                            <Bar dataKey="count" radius={[15, 15, 0, 0]}>
                              {chartData.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#D97706', '#059669', '#2563EB', '#DC2626', '#7C3AED', '#D97706', '#059669', '#2563EB', '#DC2626'][index % 9]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
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
                          <input name="userName" required placeholder="ระบุชื่อจริง-นามสกุล" className="input-field" />
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
                            <select name="year" required className="input-field flex-1">
                              {CONFIG.YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <select name="semester" required className="input-field flex-1">
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
                         <h2 className="text-3xl md:text-5xl font-black text-amber-950">ประวัติการส่งแผนการสอน</h2>
                       </div>
                    </div>

                    {/* History Filter Bar */}
                    <div className="bg-amber-50 p-4 rounded-3xl border-2 border-amber-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-900 px-1">เลือกชื่อครู</label>
                        <select 
                          className="w-full px-2 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-[10px] font-bold h-9 cursor-pointer hover:border-amber-400" 
                          value={hSearch} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setHSearch(val);
                            const list = plans.filter(p => {
                              const matchSearch = val === 'ทั้งหมด' || String(p.userName || '').trim().toLowerCase() === val.trim().toLowerCase();
                              const matchYear = hYear === 'ทั้งหมด' || String(p.year) === String(hYear);
                              const matchTerm = hTerm === 'ทั้งหมด' || String(p.semester) === String(hTerm);
                              const matchDept = hDept === 'ทั้งหมด' || String(p.department || '').trim() === hDept.trim();
                              
                              let mc = true;
                              if (hCheckStatus === 'checked') mc = p.status === 'checked' || p.status === 'approved';
                              if (hCheckStatus === 'pending') mc = p.status === 'pending';
                              let ma = true;
                              if (hApproveStatus === 'approved') ma = p.status === 'approved';
                              if (hApproveStatus === 'pending') ma = p.status === 'pending' || p.status === 'checked';
                              
                              return matchSearch && matchYear && matchTerm && matchDept && mc && ma;
                            });
                            setHistoryList(list);
                          }}
                        >
                          <option value="ทั้งหมด">ทั้งหมด (ทุกชื่อ)</option>
                          {uniqueHNames.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-900 px-1">ปีการศึกษา</label>
                        <select 
                          className="w-full px-2 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-[10px] font-bold h-9 cursor-pointer hover:border-amber-400" 
                          value={hYear} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setHYear(val);
                            const list = plans.filter(p => {
                              const matchSearch = hSearch === 'ทั้งหมด' || String(p.userName || '').trim().toLowerCase() === hSearch.trim().toLowerCase();
                              const matchYear = val === 'ทั้งหมด' || String(p.year) === String(val);
                              const matchTerm = hTerm === 'ทั้งหมด' || String(p.semester) === String(hTerm);
                              const matchDept = hDept === 'ทั้งหมด' || String(p.department || '').trim() === hDept.trim();
                              
                              let mc = true;
                              if (hCheckStatus === 'checked') mc = p.status === 'checked' || p.status === 'approved';
                              if (hCheckStatus === 'pending') mc = p.status === 'pending';
                              let ma = true;
                              if (hApproveStatus === 'approved') ma = p.status === 'approved';
                              if (hApproveStatus === 'pending') ma = p.status === 'pending' || p.status === 'checked';

                              return matchSearch && matchYear && matchTerm && matchDept && mc && ma;
                            });
                            setHistoryList(list);
                          }}
                        >
                          <option value="ทั้งหมด">ทั้งหมด</option>
                          {uniqueHYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-900 px-1">ภาคเรียน</label>
                        <select 
                          className="w-full px-2 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-[10px] font-bold h-9 cursor-pointer hover:border-amber-400" 
                          value={hTerm} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setHTerm(val);
                            const list = plans.filter(p => {
                              const matchSearch = hSearch === 'ทั้งหมด' || String(p.userName || '').trim().toLowerCase() === hSearch.trim().toLowerCase();
                              const matchYear = hYear === 'ทั้งหมด' || String(p.year) === String(hYear);
                              const matchTerm = val === 'ทั้งหมด' || String(p.semester) === String(val);
                              const matchDept = hDept === 'ทั้งหมด' || String(p.department || '').trim() === hDept.trim();
                              
                              let mc = true;
                              if (hCheckStatus === 'checked') mc = p.status === 'checked' || p.status === 'approved';
                              if (hCheckStatus === 'pending') mc = p.status === 'pending';
                              let ma = true;
                              if (hApproveStatus === 'approved') ma = p.status === 'approved';
                              if (hApproveStatus === 'pending') ma = p.status === 'pending' || p.status === 'checked';

                              return matchSearch && matchYear && matchTerm && matchDept && mc && ma;
                            });
                            setHistoryList(list);
                          }}
                        >
                          <option value="ทั้งหมด">ทั้งหมด</option>
                          {uniqueHTerms.map(s => <option key={s} value={s}>{`ภาคเรียนที่ ${s}`}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-900 px-1">กลุ่มสาระ</label>
                        <select 
                          className="w-full px-2 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-[10px] font-bold h-9 cursor-pointer hover:border-amber-400" 
                          value={hDept} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setHDept(val);
                            const list = plans.filter(p => {
                              const matchSearch = hSearch === 'ทั้งหมด' || String(p.userName || '').trim().toLowerCase() === hSearch.trim().toLowerCase();
                              const matchYear = hYear === 'ทั้งหมด' || String(p.year) === String(hYear);
                              const matchTerm = hTerm === 'ทั้งหมด' || String(p.semester) === String(hTerm);
                              const matchDept = val === 'ทั้งหมด' || String(p.department || '').trim() === val.trim();
                              
                              let mc = true;
                              if (hCheckStatus === 'checked') mc = p.status === 'checked' || p.status === 'approved';
                              if (hCheckStatus === 'pending') mc = p.status === 'pending';
                              let ma = true;
                              if (hApproveStatus === 'approved') ma = p.status === 'approved';
                              if (hApproveStatus === 'pending') ma = p.status === 'pending' || p.status === 'checked';

                              return matchSearch && matchYear && matchTerm && matchDept && mc && ma;
                            });
                            setHistoryList(list);
                          }}
                        >
                          <option value="ทั้งหมด">ทั้งหมด</option>
                          {uniqueHDepts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-900 px-1">สถานะการตรวจ</label>
                        <select 
                          className="w-full px-2 py-0 rounded-xl bg-white border-2 border-amber-200 focus:border-amber-600 outline-none transition-all duration-200 text-[10px] font-bold h-9 cursor-pointer hover:border-amber-400" 
                          value={hCheckStatus} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setHCheckStatus(val);
                            const list = plans.filter(p => {
                              const matchSearch = hSearch === 'ทั้งหมด' || String(p.userName || '').trim().toLowerCase() === hSearch.trim().toLowerCase();
                              const matchYear = hYear === 'ทั้งหมด' || String(p.year) === String(hYear);
                              const matchTerm = hTerm === 'ทั้งหมด' || String(p.semester) === String(hTerm);
                              const matchDept = hDept === 'ทั้งหมด' || String(p.department || '').trim() === hDept.trim();
                              
                              let mc = true;
                              if (val === 'checked') mc = p.status === 'checked' || p.status === 'approved';
                              if (val === 'pending') mc = p.status === 'pending';
                              let ma = true;
                              if (hApproveStatus === 'approved') ma = p.status === 'approved';
                              if (hApproveStatus === 'pending') ma = p.status === 'pending' || p.status === 'checked';

                              return matchSearch && matchYear && matchTerm && matchDept && mc && ma;
                            });
                            setHistoryList(list);
                          }}
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
                          onChange={(e) => {
                            const val = e.target.value;
                            setHApproveStatus(val);
                            const list = plans.filter(p => {
                              const matchSearch = hSearch === 'ทั้งหมด' || String(p.userName || '').trim().toLowerCase() === hSearch.trim().toLowerCase();
                              const matchYear = hYear === 'ทั้งหมด' || String(p.year) === String(hYear);
                              const matchTerm = hTerm === 'ทั้งหมด' || String(p.semester) === String(hTerm);
                              const matchDept = hDept === 'ทั้งหมด' || String(p.department || '').trim() === hDept.trim();
                              
                              let mc = true;
                              if (hCheckStatus === 'checked') mc = p.status === 'checked' || p.status === 'approved';
                              if (hCheckStatus === 'pending') mc = p.status === 'pending';
                              let ma = true;
                              if (val === 'approved') ma = p.status === 'approved';
                              if (val === 'pending') ma = p.status === 'pending' || p.status === 'checked';

                              return matchSearch && matchYear && matchTerm && matchDept && mc && ma;
                            });
                            setHistoryList(list);
                          }}
                        >
                          <option value="ทั้งหมด">ทั้งหมด</option>
                          <option value="pending">ยังไม่อนุมัติ</option>
                          <option value="approved">อนุมัติแล้ว</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={applyHistoryFilters}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs h-9 rounded-xl shadow-lg border-b-4 border-amber-950 flex items-center justify-center gap-2 transition-all active:scale-95 active:border-b-0 active:translate-y-1"
                        >
                          <Search size={14} /> กรอง
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

                    {renderPlanList('all')}
                 </motion.section>
               )}

               {activeTab === 'admin' && (
                 <motion.section 
                    key="admin"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-12"
                 >
                    <div className="flex items-center gap-6 border-l-[16px] border-gray-600 pl-8 h-12">
                      <Settings size={40} className="text-gray-600" />
                      <h2 className="text-3xl md:text-5xl font-black text-amber-950">จัดการระบบ (ผู้ดูแลระบบ)</h2>
                    </div>
                    {renderPlanList('admin')}
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
      const matchSearch = String(p.userName || '').toLowerCase().includes(checkSearch.toLowerCase());
      const matchYear = checkYear === 'ทั้งหมด' || String(p.year) === String(checkYear);
      const matchTerm = checkTerm === 'ทั้งหมด' || String(p.semester) === String(checkTerm);
      const matchDept = checkDept === 'ทั้งหมด' || String(p.department) === String(checkDept);
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
                <tr key={plan.id} className="border-b border-amber-50 hover:bg-amber-50/50 transition-colors">
                  <td className="p-4 text-center font-bold text-amber-900 border-r border-amber-50">{idx + 1}</td>
                  <td className="p-4 font-black text-amber-950 border-r border-amber-50">
                    <div className="flex flex-col">
                      <span>{plan.userName}</span>
                      <span className="text-[10px] opacity-40 font-bold">{plan.department}</span>
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
                  <tr key={plan.id} className="hover:bg-amber-50 transition-colors">
                    <td className="p-4 text-center font-black text-amber-900/40 text-sm italic">{idx + 1}</td>
                    <td className="p-4">
                      <div className="font-black text-amber-950 text-base">{plan.userName}</div>
                      <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mt-1">{plan.department}</div>
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
                    <td colSpan={mode === 'all' ? 6 : 7} className="p-24 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-10">
                        <Search size={80} />
                        <p className="font-black text-3xl italic">ไม่พบข้อมูลที่ค้นหา</p>
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

