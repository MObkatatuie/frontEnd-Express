import { Injectable } from '@angular/core';

// เก็บสถานะหน้าจัดเส้นทางไว้ตลอดการใช้งานแอป (ไม่หายเมื่อเปลี่ยนหน้า)
@Injectable({ providedIn: 'root' })
export class DispatchStore {
  plans: any[] = [];
  selected: any = null;
  jobs: any[] = [];
}