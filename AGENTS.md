# GradTrack — คู่มือสำหรับ AI agent

## หลักการจัดลำดับข้อมูล

ใช้ข้อมูลตามลำดับความใหม่และอำนาจตัดสินใจนี้เสมอ:

1. คำสั่งล่าสุดที่ผู้ใช้ระบุในแชทปัจจุบัน
2. ข้อเท็จจริงหรือการตัดสินใจล่าสุดที่ผู้ใช้ยืนยันในแชทก่อนหน้า
3. คำสั่งที่เป็นทางการใน `AGENTS.md` นี้และไฟล์ `AGENTS.md` ที่อยู่ลึกกว่า
4. โค้ด, migration, tests และเอกสารใน repository

หากข้อมูลขัดกัน ให้ถือว่าข้อมูลที่อยู่ลำดับสูงกว่าและใหม่กว่าถูกต้องกว่าเสมอ
อย่าใช้คำสั่งหรือรายละเอียดเก่าจากแชทมาแทนที่ความต้องการล่าสุดของผู้ใช้
เมื่อการตัดสินใจใหม่มีผลระยะยาวต่อการพัฒนา ให้ปรับเอกสารนี้ในงานเดียวกัน
เท่าที่ทำได้ โดยไม่บันทึกความลับหรือข้อมูลส่วนบุคคลลง repository

## ภาพรวมโครงการ

GradTrack คือเว็บติดตามแผนและความก้าวหน้าหลักสูตรสำหรับนักศึกษา โดยเน้นความเป็นส่วนตัว
รองรับการอัปโหลดเอกสารการศึกษา (เช่น curriculum และ transcript) ให้ผู้ใช้ตรวจทาน
ข้อมูลที่สกัดได้ก่อนนำไปใช้สร้างแผนการเรียน

- Stack: Next.js 15 App Router, React 19, TypeScript และ Tailwind CSS
- ฐานข้อมูล/ไฟล์: Supabase และ private bucket ชื่อ `private-documents`
- AI extraction: ใช้ Typhoon OCR อ่านไฟล์ต้นฉบับและ Typhoon text model สกัดข้อมูล เฉพาะฝั่งเซิร์ฟเวอร์หลังได้รับ consent เวอร์ชันปัจจุบันจากผู้ใช้
- การวิเคราะห์ข้อมูลการเรียนต้องรอให้ผู้ใช้อัปโหลดทั้ง Study Plan และ Transcript ครบก่อน แล้วผู้ใช้จึงกดเริ่มวิเคราะห์ครั้งเดียว; ห้ามเรียก AI อัตโนมัติหลังอัปโหลดเพียงไฟล์เดียว
- UI หลักใช้ภาษาไทย (`<html lang="th">`) และมี routing ตาม locale ใน `app/[locale]`
- แอปทำงานแบบ demo ได้เมื่อยังไม่ได้ตั้งค่า Supabase

## โครงสร้างสำคัญ

- `app/` — หน้าจอและ API routes ของ Next.js
- `components/` — React UI; หน้าในโดเมนอยู่ที่ `components/gradtrack/`
- `lib/` — domain logic, parsers, validation, Supabase และ Typhoon integration
- `supabase/migrations/` — schema migrations เรียงตามหมายเลข; migration ล่าสุดปัจจุบันคือ `0008_typhoon_document_pipeline.sql`
- `tests/` — Vitest tests ของ logic และ API-adjacent modules
- `.env.example` — รายการ environment variables ที่อนุญาตให้บันทึกเป็นตัวอย่าง; ห้าม commit `.env.local` หรือ secrets

## ขั้นตอนทำงาน

1. อ่านคำสั่งล่าสุดและตรวจไฟล์ที่เกี่ยวข้องก่อนแก้ไข ใช้ `rg` เพื่อค้นหาอย่างรวดเร็ว
2. ตรวจ `git status --short` ก่อนเริ่มงาน หากมีการแก้ไขเดิม ให้ถือเป็นงานของผู้ใช้หรือ agent อื่น
   และหลีกเลี่ยงการเขียนทับหรือ revert
3. เลือกแก้ไขแบบเล็กที่สุดที่ตอบโจทย์ รักษารูปแบบและภาษาที่ใช้ในไฟล์เดิม
4. เมื่อเปลี่ยน domain logic, API contract หรือ schema ให้ตรวจ call sites, types และ tests ที่เกี่ยวข้อง
5. เมื่อเพิ่ม/เปลี่ยน database schema ให้เพิ่ม migration ใหม่แบบ append-only; ห้ามแก้ migration ที่ใช้งานแล้ว
6. ทดสอบตามขอบเขตงาน และรายงานสิ่งที่รันพร้อมผลลัพธ์อย่างตรงไปตรงมา

## คำสั่งมาตรฐาน

```powershell
npm run dev      # รัน development server
npm test         # รัน Vitest ทั้งหมด
npm run build    # type-check และ production build
```

เริ่มจาก test ที่เกี่ยวข้องใน `tests/` ก่อน แล้วรัน `npm test` สำหรับการเปลี่ยนแปลงข้ามโมดูล
ให้รัน `npm run build` เมื่อแก้ UI, route, types หรือ configuration หากสภาพแวดล้อมเอื้ออำนวย

## ข้อกำหนดด้านข้อมูลและความปลอดภัย

- เอกสารการศึกษาเป็นข้อมูลอ่อนไหว: ส่งไฟล์ต้นฉบับให้ Typhoon OCR และส่งข้อความ OCR ให้ Typhoon text model เฉพาะจาก server หลังยืนยัน consent เวอร์ชันปัจจุบันแล้วเท่านั้น
- บันทึกผล OCR ใน `document_extractions` ได้ แต่ห้ามเก็บ error ดิบหรือ log API key, credentials, เนื้อหาเอกสาร หรือข้อมูลนักศึกษา
- ห้ามส่ง `TYPHOON_API_KEY` ไปยัง client และอย่าใช้ตัวแปร environment แบบ `NEXT_PUBLIC_` สำหรับ secret
- รักษาการเข้าถึงไฟล์ Supabase ให้เป็น private ตามเจตนาของระบบ

## แนวทางคุณภาพ

- ใช้ TypeScript types ที่ชัดเจน และตรวจ input ของ API ด้วย validation ที่มีอยู่ (Zod เมื่อเหมาะสม)
- แยก domain logic ที่ทดสอบได้ไว้ใน `lib/`; ทำ component ให้เน้น presentation และ interaction
- รักษา UX ที่ให้ผู้ใช้ตรวจและยืนยันผลสกัดข้อมูลก่อนบันทึกหรือสร้างแผน
- อย่าเปลี่ยน API หรือ schema แบบ breaking โดยไม่อัปเดตทุก consumer และ test ที่เกี่ยวข้อง
- หลีกเลี่ยง dependency ใหม่หากโค้ดและ dependency ปัจจุบันแก้ปัญหาได้

## ก่อนส่งมอบ

- ตรวจ diff เฉพาะไฟล์ที่ตั้งใจแก้
- ยืนยันว่าไม่มี secret หรือข้อมูลส่วนบุคคลหลุดเข้าไป
- สรุปสิ่งที่เปลี่ยน, tests ที่รัน และข้อจำกัด/สิ่งที่ยังไม่ได้ตรวจ
