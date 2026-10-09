# YT Downloader

เว็บไซต์สำหรับดาวน์โหลดวิดีโอ (MP4) และเสียง (MP3) จาก YouTube รันบนเครื่องตัวเอง

## ฟีเจอร์
- วางลิงก์ YouTube → แสดงข้อมูลวิดีโอ (ชื่อ, รูป, ความยาว)
- ดาวน์โหลดวิดีโอ MP4 เลือกความละเอียดได้ (1080p, 720p, …)
- ดาวน์โหลด MP3 เลือก bitrate ได้ (128–320 kbps)
- รองรับ playlist (ดาวน์โหลดทั้งหมด แล้วรวมเป็น .zip)
- แสดง progress ระหว่างการดาวน์โหลด

## ติดตั้ง
```bash
pip install -r requirements.txt
```
> ffmpeg จะถูกรับรองอัตโนมัติจากแพ็กเกจ `imageio-ffmpeg`
> (ถ้ามี ffmpeg บน PATH อยู่แล้ว จะใช้ตัวนั้นก่อน)

## รัน
```bash
python app.py
```
แล้วเปิด http://localhost:5000

## โครงสร้าง
```
app.py              # Flask backend (yt-dlp)
templates/index.html
static/style.css
static/app.js
downloads/          # ไฟล์ที่ดาวน์โหลด (ไม่เข้า git)
```

## หมายเหตุ
- ใช้งานเพื่อตนเองเท่านั้น ให้ respect ลิขสิทธิ์ผู้สร้างเนื้อหา
- YouTube เปลี่ยนระบบบ่อย ๆ ถ้าดาวน์โหลดไม่ได้ ให้อัปเดต yt-dlp:
  `pip install -U yt-dlp`
