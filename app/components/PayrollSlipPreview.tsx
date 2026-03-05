/**
 * =============================================================================
 * FILE: app/components/PayrollSlipPreview.tsx
 * =============================================================================
 * Payroll Slip Preview - A4 Full Page (210mm x 297mm)
 */

"use client";

interface PayrollItem {
  fieldName: string;
  label: string;
  amount: number;
}

interface CompanyInfo {
  company_name?: string;
  company_name_en?: string;
  address?: string;
  tel?: string;
  tax_id?: string;
  logo_url?: string;
}

interface PayrollSlipPreviewProps {
  companyInfo: CompanyInfo;
  payPeriod: string;
  employeeId: string;
  employeeName: string;
  nickname?: string;
  position?: string;
  workingDays?: number;
  leaveDays?: number;
  lateMinutes?: number;
  bankAccount?: string;
  earnings: PayrollItem[];
  deductions: PayrollItem[];
  totalIncome: number;
  totalDeduction: number;
  netSalary: number;
}

export default function PayrollSlipPreview({
  companyInfo,
  payPeriod,
  employeeId,
  employeeName,
  nickname,
  position,
  workingDays,
  leaveDays,
  lateMinutes,
  bankAccount,
  earnings,
  deductions,
  totalIncome,
  totalDeduction,
  netSalary,
}: PayrollSlipPreviewProps) {
  
  const activeEarnings = earnings.filter(item => item.amount > 0);
  const activeDeductions = deductions.filter(item => item.amount > 0);
  
  return (
    <div 
      className="bg-white text-black mx-auto shadow-sm"
      style={{ 
        fontFamily: "'Noto Sans Thai', sans-serif",
        width: '210mm',
        height: '297mm'
      }}
    >
      <div className="h-full flex flex-col border border-gray-300">
        {/* Header */}
        <div className="border-b border-gray-300 bg-gray-50 px-8 py-6 flex-shrink-0">
          <div className="text-center">
            {/* Logo */}
            {companyInfo.logo_url && (
              <div className="mb-3 flex justify-center">
                <img 
                  src={companyInfo.logo_url} 
                  alt="Company Logo" 
                  className="max-h-16 max-w-[220px] object-contain"
                />
              </div>
            )}
            
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {companyInfo.company_name || "บริษัท ทดสอบ จำกัด"}
            </h1>
            {companyInfo.company_name_en && (
              <p className="text-sm text-gray-600 mb-2">{companyInfo.company_name_en}</p>
            )}
            <div className="text-sm text-gray-600 leading-relaxed">
              <p>{companyInfo.address || "123 ถนนทดสอบ กรุงเทพฯ 10100"}</p>
              <p>
                โทรศัพท์: {companyInfo.tel || "02-123-4567"} | 
                เลขประจำตัวผู้เสียภาษี: {companyInfo.tax_id || "0-0000-00000-00-0"}
              </p>
            </div>
          </div>
        </div>

        {/* Title Bar */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white py-3 text-center flex-shrink-0">
          <h2 className="text-lg font-bold tracking-wide">สลิปเงินเดือน / PAY SLIP</h2>
        </div>

        {/* Content - ใช้ flex-1 และ justify-between เพื่อกระจายเนื้อหา */}
        <div className="flex-1 px-8 py-6 flex flex-col justify-between">
          <div className="space-y-5">
            {/* Employee Info */}
            <div className="border border-gray-300 rounded overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-gray-300">
                <h3 className="font-bold text-slate-800 text-sm">ข้อมูลพนักงาน / Employee Information</h3>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-2.5 px-4 w-[15%] font-semibold text-gray-700 bg-slate-50">รหัสพนักงาน:</td>
                    <td className="py-2.5 px-4 w-[35%] text-gray-900">{employeeId}</td>
                    <td className="py-2.5 px-4 w-[15%] font-semibold text-gray-700 bg-slate-50">งวดเงินเดือน:</td>
                    <td className="py-2.5 px-4 w-[35%] text-gray-900">{payPeriod}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2.5 px-4 font-semibold text-gray-700 bg-slate-50">ชื่อ-สกุล:</td>
                    <td className="py-2.5 px-4 text-gray-900">
                      {employeeName} {nickname ? `(${nickname})` : ''}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-gray-700 bg-slate-50">ตำแหน่ง:</td>
                    <td className="py-2.5 px-4 text-gray-900">{position || '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-gray-700 bg-slate-50">วันทำงาน:</td>
                    <td className="py-2.5 px-4 text-gray-900">{workingDays || 0} วัน</td>
                    <td className="py-2.5 px-4 font-semibold text-gray-700 bg-slate-50">บัญชีธนาคาร:</td>
                    <td className="py-2.5 px-4 text-gray-900">{bankAccount || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Earnings & Deductions Tables */}
            <div className="grid grid-cols-2 gap-6">
              
              {/* Earnings Table */}
              <div className="border border-blue-300 rounded overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2">
                  <h3 className="font-bold text-sm">รายได้ / EARNINGS</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-blue-50 border-b border-blue-300">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-bold text-gray-800">รายการ</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-800 w-[130px]">จำนวนเงิน (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEarnings.length > 0 ? (
                      activeEarnings.map((item, index) => (
                        <tr key={index} className="border-b border-gray-200 hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-2 text-gray-800">{item.label}</td>
                          <td className="px-4 py-2 text-right font-semibold text-blue-700 tabular-nums">
                            {item.amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-4 py-4 text-center text-gray-500">ไม่มีรายการ</td>
                      </tr>
                    )}
                    <tr className="bg-blue-100 border-t-2 border-blue-400">
                      <td className="px-4 py-2.5 font-bold text-gray-900">รวมรายได้</td>
                      <td className="px-4 py-2.5 text-right font-bold text-blue-800 tabular-nums">
                        {totalIncome.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Deductions Table */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 py-2">
                  <h3 className="font-bold text-sm">รายการหัก / DEDUCTIONS</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-300">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-bold text-gray-800">รายการ</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-800 w-[130px]">จำนวนเงิน (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDeductions.length > 0 ? (
                      activeDeductions.map((item, index) => (
                        <tr key={index} className="border-b border-gray-200 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2 text-gray-800">
                            {item.label}
                            {item.label.includes('วันลา') && leaveDays ? ` (${leaveDays} วัน)` : ''}
                            {item.label.includes('มาสาย') && lateMinutes ? ` (${lateMinutes} นาที)` : ''}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-700 tabular-nums">
                            {item.amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-4 py-4 text-center text-gray-500">ไม่มีรายการ</td>
                      </tr>
                    )}
                    <tr className="bg-slate-100 border-t-2 border-slate-400">
                      <td className="px-4 py-2.5 font-bold text-gray-900">รวมรายการหัก</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-800 tabular-nums">
                        {totalDeduction.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Net Salary */}
            <div className="border border-indigo-300 rounded-lg px-5 py-4 bg-gradient-to-r from-indigo-50/50 to-blue-50/50">
              <div className="flex items-baseline justify-end gap-3">
                <span className="text-base text-gray-600 font-semibold">เงินได้สุทธิ / Net Salary:</span>
                <span className="text-3xl font-bold text-indigo-800 tabular-nums">
                  ฿ {netSalary.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Signature Section - ด้านล่าง */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-16 pt-6 border-t border-gray-300">
              <div>
                <div className="h-16 mb-2"></div>
                <div className="border-t border-gray-500 pt-2 text-center">
                  <p className="text-sm font-semibold text-gray-800">ผู้จ่ายเงิน / Authorized By</p>
                  <p className="text-xs text-gray-600 mt-1">วันที่ / Date: ........................</p>
                </div>
              </div>
              <div>
                <div className="h-16 mb-2"></div>
                <div className="border-t border-gray-500 pt-2 text-center">
                  <p className="text-sm font-semibold text-gray-800">ผู้รับเงิน / Received By</p>
                  <p className="text-xs text-gray-600 mt-1">วันที่ / Date: ........................</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-gray-300 text-center">
              <p className="text-xs text-gray-500">เอกสารนี้สร้างโดยระบบอัตโนมัติ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}