/**
 * =============================================================================
 * FILE PATH: app/components/ReceiptPreview.tsx
 * =============================================================================
 * 
 * Receipt Preview Component
 * แสดงตัวอย่างใบเสร็จแบบสวยงาม พร้อม Logo, ข้อมูลบริษัท, รายการสินค้า
 */

"use client";

interface ReceiptItem {
  description: string;
  quantity: number;
  amount_before_vat: number;
  vat_amount: number;
  amount_after_vat: number;
}

interface PaymentMethod {
  method: string;
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

interface ReceiptPreviewProps {
  hasVAT?: boolean; // ✅ เพิ่ม flag
  companyInfo: CompanyInfo;
  receiptNo: string;
  date: string;
  customerId: string;
  customerName: string;
  customerTel?: string;
  customerAddress?: string;
  items: ReceiptItem[];
  subtotal_before_vat: number;
  total_vat: number;
  total_after_vat: number;
  paymentMethods: PaymentMethod[];
}

export default function ReceiptPreview({
  hasVAT = true, // ✅ Default = true (backward compatibility)
  companyInfo,
  receiptNo,
  date,
  customerId,
  customerName,
  customerTel,
  customerAddress,
  items,
  subtotal_before_vat,
  total_vat,
  total_after_vat,
  paymentMethods,
}: ReceiptPreviewProps) {
  return (
    <div 
      className="bg-white text-black p-8 max-w-3xl mx-auto"
      style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
    >
      {/* Header */}
      <div className="text-center mb-6 pb-6 border-b-2 border-slate-800">
        {/* ปิด Logo ชั่วคราว - ใช้แค่ชื่อบริษัท */}

        {/* Company Name */}
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          {companyInfo.company_name || "บริษัท ทดสอบ จำกัด"}
        </h1>
        {companyInfo.company_name_en && (
          <p className="text-sm text-slate-600 mb-2">
            {companyInfo.company_name_en}
          </p>
        )}

        {/* Company Info */}
        <p className="text-sm text-slate-600 mb-1">
          {companyInfo.address || "123 ถนนทดสอบ กรุงเทพฯ 10100"}
        </p>
        <p className="text-sm text-slate-600">
          โทร: {companyInfo.tel || "02-123-4567"} | 
          เลขประจำตัวผู้เสียภาษี: {companyInfo.tax_id || "0-0000-00000-00-0"}
        </p>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-1">
          ใบเสร็จรับเงิน / RECEIPT
        </h2>
        <div className="w-32 h-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent mx-auto"></div>
      </div>

      {/* Receipt Info */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p className="text-slate-600">เลขที่ / No.:</p>
          <p className="font-bold text-slate-800">{receiptNo}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-600">วันที่ / Date:</p>
          <p className="font-bold text-slate-800">{date}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs text-slate-600 uppercase mb-3 font-semibold">
          ข้อมูลลูกค้า / Customer Information
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-600">รหัสลูกค้า / Customer ID:</span>
            <p className="font-semibold text-slate-800">{customerId}</p>
          </div>
          <div>
            <span className="text-slate-600">ชื่อ / Name:</span>
            <p className="font-semibold text-slate-800">{customerName}</p>
          </div>
          {customerTel && (
            <div>
              <span className="text-slate-600">เบอร์โทร / Tel:</span>
              <p className="font-semibold text-slate-800">{customerTel}</p>
            </div>
          )}
          {customerAddress && (
            <div className="col-span-2">
              <span className="text-slate-600">ที่อยู่ / Address:</span>
              <p className="font-semibold text-slate-800">{customerAddress}</p>
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-6 text-sm">
        <thead>
          <tr className="border-b-2 border-slate-800">
            <th className="text-left py-3 font-bold text-slate-800 w-12">
              ลำดับ<br/>No.
            </th>
            <th className="text-left py-3 font-bold text-slate-800">
              รายการ / Description
            </th>
            <th className="text-center py-3 font-bold text-slate-800 w-16">
              จำนวน<br/>Qty
            </th>
            {hasVAT ? (
              <>
                <th className="text-right py-3 font-bold text-slate-800 w-24">
                  ก่อนภาษี<br/>Before VAT
                </th>
                <th className="text-right py-3 font-bold text-slate-800 w-20">
                  ภาษี<br/>VAT
                </th>
                <th className="text-right py-3 font-bold text-slate-800 w-24">
                  หลังภาษี<br/>After VAT
                </th>
              </>
            ) : (
              <th className="text-right py-3 font-bold text-slate-800 w-32">
                ยอดเงิน<br/>Amount
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="border-b border-slate-200">
              <td className="py-3 text-center text-slate-700">{index + 1}</td>
              <td className="py-3 text-slate-700">{item.description}</td>
              <td className="py-3 text-center text-slate-700">{item.quantity}</td>
              {hasVAT ? (
                <>
                  <td className="py-3 text-right text-slate-700">
                    {item.amount_before_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 text-right text-slate-700">
                    {item.vat_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-800">
                    {item.amount_after_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                </>
              ) : (
                <td className="py-3 text-right font-semibold text-slate-800">
                  {item.amount_after_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="flex justify-end mb-6">
        <div className="w-96">
          {hasVAT ? (
            <>
              {/* ยอดรวมก่อนภาษี */}
              <div className="flex justify-between py-2 border-b border-slate-200 text-sm">
                <span className="text-slate-600">ยอดรวมก่อนภาษี / Subtotal Before VAT:</span>
                <span className="font-semibold text-slate-800">
                  {subtotal_before_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                </span>
              </div>
              
              {/* ภาษี VAT 7% */}
              <div className="flex justify-between py-2 border-b border-slate-200 text-sm">
                <span className="text-slate-600">ภาษีมูลค่าเพิ่ม 7% / VAT 7%:</span>
                <span className="font-semibold text-slate-800">
                  {total_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                </span>
              </div>
              
              {/* ยอดรวมหลังภาษี */}
              <div className="flex justify-between py-3 border-t-2 border-slate-800">
                <span className="font-bold text-slate-800">ยอดรวมหลังภาษี / Grand Total:</span>
                <span className="font-bold text-xl text-slate-800">
                  {total_after_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                </span>
              </div>
            </>
          ) : (
            /* ไม่มี VAT - แสดงยอดรวมอย่างเดียว */
            <div className="flex justify-between py-3 border-t-2 border-slate-800">
              <span className="font-bold text-slate-800">ยอดรวม / Grand Total:</span>
              <span className="font-bold text-xl text-slate-800">
                {total_after_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Methods */}
      {paymentMethods.length > 0 && (
        <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600 uppercase mb-3 font-semibold">
            วิธีการชำระเงิน / Payment Method
          </p>
          <div className="space-y-2">
            {paymentMethods.map((payment, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <span className="text-slate-700">{payment.method}</span>
                <span className="font-semibold text-slate-800">
                  {payment.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signature */}
      <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300">
        <div className="text-center">
          <div className="h-16 mb-2"></div>
          <div className="border-t border-slate-400 pt-2">
            <p className="text-sm text-slate-600">ผู้รับเงิน / Receiver</p>
          </div>
        </div>
        <div className="text-center">
          <div className="h-16 mb-2"></div>
          <div className="border-t border-slate-400 pt-2">
            <p className="text-sm text-slate-600">ผู้จ่ายเงิน / Payer</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-8 pt-6 border-t border-slate-300">
        <p className="text-sm text-slate-500">
          ขอบคุณที่ใช้บริการ / Thank you for your business
        </p>
      </div>
    </div>
  );
}