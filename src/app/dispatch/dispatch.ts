import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import * as L from 'leaflet';
import { Api } from '../api';
import { DispatchStore } from './dispatch-store';

@Component({
  selector: 'app-dispatch',
  imports: [DecimalPipe],
  templateUrl: './dispatch.html',
  styleUrl: './dispatch.css',
})
export class Dispatch implements AfterViewInit, OnDestroy {
  private api = inject(Api);
  private cdr = inject(ChangeDetectorRef);
  store = inject(DispatchStore);
  private map!: L.Map;
  private layer?: L.LayerGroup;

  loading = false;
  error = '';

  // ให้ HTML เดิมใช้ชื่อเดิมได้ แต่ข้อมูลจริงอยู่ใน store
  get plans() { return this.store.plans; }
  get selected() { return this.store.selected; }
  get jobs() { return this.store.jobs; }

  ngAfterViewInit() {
    this.map = L.map('map').setView([16.24486, 103.24784], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OpenStreetMap' }).addTo(this.map);
    L.circleMarker([16.24486, 103.24784], { radius: 9, color: '#111', fillOpacity: 1 })
      .bindPopup('ร้าน').addTo(this.map);

    if (this.store.selected) {
      this.drawPlan(this.store.selected);   // กลับมาหน้านี้: วาดแผนเดิม
    } else {
      this.loadSaved();                     // เปิดใหม่/รีเฟรช: ดึงแผนที่ยืนยันแล้ว
    }
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private fail = (err: any) => {
    this.error = err.error?.error ?? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
    this.loading = false;
    this.cdr.markForCheck();
  };

  // แผนที่ยืนยันไว้แล้วในฐานข้อมูล (ไม่มีก็ไม่เป็นไร)
  loadSaved() {
    this.api.current().subscribe({
      next: res => {
        const saved = { ...res, label: 'แผนที่ยืนยันแล้ว (' + res.route_date + ')', saved: true };
        this.store.plans = [];
        this.store.selected = saved;
        this.store.jobs = res.routes.map((r: any) => ({ job_code: r.job_code, rider: r.rider.name, color: r.rider.color }));
        this.drawPlan(saved);
        this.cdr.markForCheck();
      },
      error: () => {},   // 404 = ยังไม่มีแผนที่บันทึก
    });
  }
  
  calculate() {
    this.loading = true;
    this.error = '';
    this.api.plans().subscribe({
      next: res => {
        this.store.plans = res.plans;
        this.loading = false;
        this.select(res.plans[0]);
        this.cdr.markForCheck();
      },
      error: this.fail,
    });
  }

  select(plan: any) {
    this.store.selected = plan;
    this.store.jobs = [];
    this.drawPlan(plan);
  }

  drawPlan(plan: any) {
    this.layer?.remove();
    this.layer = L.layerGroup().addTo(this.map);
    const bounds: L.LatLngExpression[] = [];
    for (const r of plan.routes) {
      L.polyline(r.path, { color: r.rider.color, weight: 5 }).addTo(this.layer);
      for (const s of r.stops) {
        const p: L.LatLngExpression = [s.customer.latitude, s.customer.longitude];
        bounds.push(p);
        L.circleMarker(p, { radius: 7, color: r.rider.color, fillOpacity: 1 })
          .bindPopup(`${r.rider.name} จุดที่ ${s.seq}: ${s.customer.name} (${s.eta})`)
          .addTo(this.layer);
      }
    }
    if (bounds.length) this.map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
  }

  confirm() {
    this.loading = true;
    this.api.confirm(this.store.selected.plan_token).subscribe({
      next: res => {
        this.store.jobs = res.jobs;
        this.store.selected = { ...this.store.selected, saved: true };
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: this.fail,
    });
  }
}
//one