import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';

@Component({
  selector: 'app-rider',
  imports: [FormsModule],
  templateUrl: './rider.html',
  styleUrl: './rider.css',
})
export class Rider {
  private api = inject(Api);
  private cdr = inject(ChangeDetectorRef);
  code = '';
  job: any = null;
  error = '';
  loading = false;

  search() {
    if (!this.code.trim()) return;
    this.loading = true;
    this.error = '';
    this.job = null;
    this.api.job(this.code.trim()).subscribe({
      next: res => {
        this.job = res;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = err.error?.error ?? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }
}