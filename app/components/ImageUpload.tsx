/**
 * Image Upload Component
 */

import { useState } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps {
  fieldName: string;
  label: string;
  required: boolean;
  value?: string;
  onChange: (url: string) => void;
}

export default function ImageUpload({
  fieldName,
  label,
  required,
  value,
  onChange,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("ขนาดไฟล์ต้องไม่เกิน 5MB");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      onChange(result.directUrl);
      
      console.log("✅ Image uploaded:", result.fileId);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError("อัพโหลดไม่สำเร็จ กรุณาลองใหม่");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange("");
    setError(null);
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {!preview ? (
        <label className="block w-full cursor-pointer">
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-blue-400 hover:bg-blue-50/50 transition-all">
            <div className="flex flex-col items-center justify-center gap-3">
              {uploading ? (
                <>
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  <p className="text-sm text-slate-600 font-medium">กำลังอัพโหลด...</p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-slate-400" />
                  <div className="text-center">
                    <p className="text-sm text-slate-700 font-semibold">คลิกเพื่อเลือกรูปภาพ</p>
                    <p className="text-xs text-slate-500 mt-1">JPG, PNG, GIF (สูงสุด 5MB)</p>
                  </div>
                </>
              )}
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
        </label>
      ) : (
        <div className="relative group">
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-64 object-contain"
            />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg shadow-lg transition-all opacity-0 group-hover:opacity-100"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-2 left-2 bg-black/60 text-white px-3 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-all">
            <ImageIcon className="w-4 h-4 inline mr-1" />
            รูปภาพที่อัพโหลดแล้ว
          </div>
        </div>
      )}
    </div>
  );
}