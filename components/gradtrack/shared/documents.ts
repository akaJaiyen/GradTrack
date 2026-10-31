export type Doc = {
  id: string;
  type: string;
  file_name: string;
  status: string;
  extraction_error?: string | null;
  created_at: string;
};

export const documentStatusLabels: Record<string, string> = {
  uploaded: "อัปโหลดแล้ว",
  extracting: "กำลังอ่าน",
  review_needed: "ต้องตรวจสอบ",
  ready: "พร้อมใช้",
  failed: "อ่านไม่สำเร็จ",
  rate_limited: "โควตา AI หมด",
};
