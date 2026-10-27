import { Component, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { RoadMap } from '../road-map';

@Component({
  selector: 'app-rider',
  imports: [FormsModule, RoadMap],
  templateUrl: './rider.html',
  styleUrl: './rider.css',
})
export class Rider {
  private api = inject(Api);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  code = '';
  job: any = null;
  error = '';
  loading = false;

  search() {
    if (this.loading || !this.code.trim()) return;
    this.loading = true;
    this.error = '';
    this.job = null;
    this.api.job(this.code.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
