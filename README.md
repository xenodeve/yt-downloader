# YT Downloader

เว็บไซต์สำหรับดาวน์โหลดวิดีโอ (MP4) และเสียง (MP3) จาก **YouTube, Facebook, TikTok, Instagram** รันบนเครื่องตัวเอง — UI ภาษาไทย/English สลับได้

## ฟีเจอร์
- วางลิงก์ → แสดงข้อมูล (ชื่อ, รูป, ความยาว) พร้อม index 4 ขั้นตอนด้านซ้าย
- ดาวน์โหลดวิดีโอ MP4 เลือกความละเอียด / ดาวน์โหลด MP3 เลือก bitrate (128–320 kbps)
- รองรับ playlist → รวมเป็น `.zip`
- progress bar + chip แสดงสถานะ yt-dlp, ปุ่ม Save file เมื่อเสร็จ
- สลับ EN/TH ทั้งหน้า, dark mode อัตโนมัติ, favicon + og card

ลิงก์ที่รับ (server เป็นตัวตรวจจริง, client ตรวจก่อนส่ง):
`youtube.com/watch`, `youtu.be`, `shorts` · `facebook.com/watch|reel`, `fb.watch` · `instagram.com/p|reel`, `instagr.am` · `tiktok.com`, `vm.tiktok.com`, `m.tiktok.com` — sites อื่นโดนปฏิเสธ

## Cookies (สำคัญ)
YouTube/Instagram/Facebook จะบล็อกคำขอ anonymous ว่า "Sign in to confirm you're not a bot" — app ส่ง cookies ไปกับ yt-dlp ได้ 2 ทาง:
1. วางไฟล์ `cookies.txt` ข้าง `app.py` (export จาก extension เช่น "Get cookies.txt LOCALLY") — app ใช้เองอัตโนมัติ
2. ตั้ง env `YTDLP_BROWSER=chrome` (หรือ firefox/edge) แล้วรัน app — อ่าน cookies ตรงจาก browser

`cookies.txt` คือ session login ของคุณ — `.gitignore` กันไว้แล้ว, อย่า commit

## ติดตั้งและรัน
```bash
pip install -r requirements.txt
python app.py
```
เปิด http://localhost:5000 · ffmpeg ใช้ตัวบน PATH ก่อน, ไม่มีก็ใช้ `imageio-ffmpeg` อัตโนมัติ

## ทดสอบ
```bash
python -m pytest tests/ -q                # 17 tests (validation, filename, playlist, jobs, assets, cookies)
python scripts/gate-snapshot.py           # สร้าง snapshot จากหน้า Flask จริง
python -m http.server 8124 --directory design-exploration
node tests/e2e_ui.js  http://localhost:8124/gate-snapshot.html   # Playwright, mock API
node tests/e2e_live.js http://127.0.0.1:5000                     # Playwright, server+yt-dlp จริง
```
E2E ต้องมี Node + Playwright (`npm i -D playwright`)

## โครงสร้าง
```
app.py                # Flask backend (yt-dlp, validation, jobs, cookies)
templates/index.html  # UI (Jinja, EN/TH keys)
static/style.css      # Print Tech ledger design + dark mode
static/app.js         # client logic + I18N dict
scripts/make-og.py    # สร้าง og.png (PNG encoder มือเขียน, ไม่ต้องมี Pillow)
scripts/gate-snapshot.py
tests/                # pytest + Playwright E2E
downloads/            # ไฟล์ที่ดาวน์โหลด (ไม่เข้า git)
bin/                  # ffmpeg จาก imageio-ffmpeg (ไม่เข้า git)
```

## หมายเหตุ
- ใช้งานเพื่อตนเองเท่านั้น ให้ respect ลิขสิทธิ์ผู้สร้างเนื้อหา
- YouTube/IG/FB เปลี่ยนระบบบ่อย — ดาวน์โหลดไม่ได้ให้อัปเดต `pip install -U yt-dlp` ก่อน, แล้วยัน cookies
