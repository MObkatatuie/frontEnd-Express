import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import * as L from 'leaflet';

import { Api } from '../api';
import { DispatchStore } from './dispatch-store';
import type { RoadRoute } from '../road-routing.service';

const SHOP_LAT = 16.24486;
const SHOP_LNG = 103.24784;

// ระยะเยื้องหมุดที่อยู่ตำแหน่งเดียวกัน
const MARKER_OFFSET = 0.00012;

@Component({
  selector: 'app-dispatch',
  imports: [DecimalPipe],
  templateUrl: './dispatch.html',
  styleUrl: './dispatch.css',
})
export class Dispatch implements AfterViewInit, OnDestroy {
  private api = inject(Api);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  store = inject(DispatchStore);

  routeMetrics: Record<string, RoadRoute> = {};
  routingBusy = false;

  private map!: L.Map;
  private layer?: L.LayerGroup;

  loading = false;
  error = '';
  calculating = false;

  get plans() {
    return this.store.plans;
  }

  get selected() {
    return this.store.selected;
  }

  get jobs() {
    return this.store.jobs;
  }

  ngAfterViewInit() {
    this.map = L.map('map').setView(
      [SHOP_LAT, SHOP_LNG],
      14
    );

    L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '© OpenStreetMap contributors · Routing: OSRM'
      }
    ).addTo(this.map);

    this.drawShopMarker();

    if (this.store.selected) {
      void this.drawPlan(this.store.selected);
    } else {
      this.loadSaved();
    }
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private fail = (err: any) => {
    this.error =
      err?.error?.error ??
      'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';

    this.loading = false;
    this.calculating = false;
    this.cdr.markForCheck();
  };

  loadSaved() {
    this.loading = true;
    this.api.current().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.loading = false;
        const saved = { ...res, label: 'แผนที่ยืนยันแล้ว (' + res.route_date + ')', saved: true };
        this.store.plans = [];
        this.store.selected = saved;

        this.store.jobs = (res.routes ?? []).map((r: any) => ({
          job_code: r.job_code,
          rider: r.rider?.name ?? 'ไรเดอร์',
          color: r.rider?.color ?? '#2563eb'
        }));

        void this.drawPlan(saved);
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        if (err.status !== 404) this.fail(err);
        this.cdr.markForCheck();
      },
    });
  }

  calculate() {
    if (this.loading) return;
    this.loading = true;
    this.calculating = true;
    this.error = '';
    this.api.plans().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        if (!res.plans?.[0]?.routes?.every((r: any) => r.path?.length >= 2)) {
          this.fail({ error: { error: 'ไม่พบเส้นทางถนนครบทุกไรเดอร์ กรุณาคำนวณใหม่' } });
          return;
        }
        this.calculating = false;
        this.store.plans = res.plans;
        this.loading = false;

        if (this.store.plans.length) {
          this.select(this.store.plans[0]);
        } else {
          this.error = 'ยังไม่มีแผนจัดส่งให้แสดง';
        }

        this.cdr.markForCheck();
      },
      error: this.fail
    });
  }

  select(plan: any) {
    this.store.selected = plan;
    this.store.jobs = [];
    void this.drawPlan(plan);
  }

  // แปลงพิกัดให้เป็นตัวเลข และตรวจสอบความถูกต้อง
  private getCustomerPoint(s: any): {
    lat: number;
    lng: number;
  } | null {
    const lat = Number(s.customer?.latitude);
    const lng = Number(s.customer?.longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    return { lat, lng };
  }

  // เรียงจุดส่งตามลำดับที่แผนจัดส่งกำหนด
  private sortStops(stops: any[]): any[] {
    return [...stops].sort((a, b) => {
      const seqA = Number(a.seq);
      const seqB = Number(b.seq);

      if (!Number.isFinite(seqA) && !Number.isFinite(seqB)) {
        return 0;
      }

      if (!Number.isFinite(seqA)) return 1;
      if (!Number.isFinite(seqB)) return -1;

      return seqA - seqB;
    });
  }

  private escapeHtml(value: unknown): string {
    const element = document.createElement('span');
    element.textContent = String(value ?? '-');
    return element.innerHTML;
  }

  private locationKey(lat: number, lng: number): string {
    return `${lat.toFixed(6)},${lng.toFixed(6)}`;
  }

  // วาดหมุดเป็นวงกลมพร้อมหมายเลข
  private addNumberedMarker(
    lat: number,
    lng: number,
    sequence: string | number,
    color: string,
    popup: string
  ) {
    const icon = L.divIcon({
      className: 'dispatch-number-marker',
      html: `
        <div style="
          width:30px;
          height:30px;
          box-sizing:border-box;
          border:2px solid white;
          border-radius:50%;
          background:${color};
          color:white;
          display:flex;
          justify-content:center;
          align-items:center;
          font-size:13px;
          font-weight:700;
          box-shadow:0 2px 6px rgba(0,0,0,.45);
        ">${sequence}</div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    L.marker([lat, lng], { icon })
      .bindPopup(popup)
      .addTo(this.layer!);
  }

  private drawShopMarker() {
    L.circleMarker([SHOP_LAT, SHOP_LNG], {
      radius: 9,
      color: '#111827',
      weight: 2,
      fillColor: '#facc15',
      fillOpacity: 1
    })
      .bindPopup('ร้านอาหาร — จุดเริ่มต้น')
      .addTo(this.map);
  }

  drawPlan(plan: any) {
    if (!this.map || !plan) {
      return;
    }

    this.layer?.remove();
    this.layer = L.layerGroup().addTo(this.map);

    this.routeMetrics = {};
    this.routingBusy = true;
    this.error = '';

    const bounds: L.LatLngExpression[] = [
      [SHOP_LAT, SHOP_LNG]
    ];

    const routes = plan.routes ?? [];

    // สร้างรายการหมุดทั้งหมดก่อน เพื่อหาออเดอร์ที่พิกัดซ้ำกัน
    const markerItems: Array<{
      route: any;
      stop: any;
      lat: number;
      lng: number;
      sequence: number;
      key: string;
    }> = [];

    for (const r of routes) {
      const stops = this.sortStops(r.stops ?? []);

      stops.forEach((s: any, index: number) => {
        const point = this.getCustomerPoint(s);

        if (!point) {
          return;
        }

        const sequence = Number(s.seq);
        const displaySequence =
          Number.isFinite(sequence) && sequence > 0
            ? sequence
            : index + 1;

        markerItems.push({
          route: r,
          stop: s,
          lat: point.lat,
          lng: point.lng,
          sequence: displaySequence,
          key: this.locationKey(point.lat, point.lng)
        });
      });
    }

    // จัดกลุ่มหมุดที่มีพิกัดเดียวกัน
    const duplicateGroups = new Map<
      string,
      typeof markerItems
    >();

    for (const item of markerItems) {
      const group = duplicateGroups.get(item.key) ?? [];
      group.push(item);
      duplicateGroups.set(item.key, group);
    }

    // วาดเส้นทางของแต่ละไรเดอร์ตามลำดับจุดส่ง
    for (const r of routes) {
      const stops = this.sortStops(r.stops ?? []);
      const color = r.rider?.color || '#2563eb';
      const riderName = r.rider?.name || 'ไรเดอร์';

      if (Array.isArray(r.path) && r.path.length >= 2) {
        const road: RoadRoute = {
          coordinates: r.path,
          distanceKm: r.distance_km,
          durationMin: r.time_min
        };
        this.routeMetrics[String(r.rider?.rider_id ?? riderName)] = road;
        const popup = document.createElement('span');
        popup.textContent = riderName + ': ' + road.distanceKm.toFixed(2) + ' กม. · ' + road.durationMin.toFixed(1) + ' นาทีโดยประมาณ';
        L.polyline(road.coordinates, { color, weight: 5, opacity: 0.9 })
          .bindPopup(popup).addTo(this.layer);
        bounds.push(...road.coordinates);
      } else {
        this.error = 'ไม่พบเส้นทางถนนจากเซิร์ฟเวอร์ กรุณาคำนวณใหม่';
      }
    }

    // วาดหมุดหลังเส้นทาง เพื่อให้ทุกหมุดอยู่เหนือเส้น
    for (const item of markerItems) {
      const group = duplicateGroups.get(item.key) ?? [];
      const index = group.indexOf(item);

      let displayLat = item.lat;
      let displayLng = item.lng;

      if (group.length > 1) {
        // กระจายหมุดรอบตำแหน่งจริงเพื่อให้มองเห็นแยกกัน
        const angle =
          -Math.PI / 2 +
          (2 * Math.PI * index) / group.length;

        displayLat += Math.cos(angle) * MARKER_OFFSET;
        displayLng +=
          Math.sin(angle) *
          MARKER_OFFSET /
          Math.max(
            Math.cos(item.lat * Math.PI / 180),
            0.2
          );
      }

      const s = item.stop;
      const r = item.route;
      const riderName = r.rider?.name || 'ไรเดอร์';
      const color = r.rider?.color || '#2563eb';

      bounds.push([displayLat, displayLng]);

      this.addNumberedMarker(
        displayLat,
        displayLng,
        item.sequence,
        color,
        `
          <b>จุดส่งที่ ${item.sequence}</b><br>
          ลูกค้า: ${this.escapeHtml(s.customer?.name ?? '-')}<br>
          ออเดอร์: ${this.escapeHtml(s.order_id ?? '-')}<br>
          ไรเดอร์: ${this.escapeHtml(riderName)}<br>
          จำนวน: ${this.escapeHtml(s.boxes ?? '-')} กล่อง<br>
          เวลา: ${this.escapeHtml(s.eta ?? '-')}
          ${
            group.length > 1
              ? '<br><b>พิกัดนี้มีหลายออเดอร์</b>'
              : ''
          }
        `
      );
    }

    // หมุดร้านค้าเป็นจุดเริ่มต้นเสมอ
    L.circleMarker([SHOP_LAT, SHOP_LNG], {
      radius: 9,
      color: '#111827',
      weight: 2,
      fillColor: '#facc15',
      fillOpacity: 1
    })
      .bindPopup('ร้านอาหาร — จุดเริ่มต้น')
      .addTo(this.layer);

    if (bounds.length > 1) {
      this.map.fitBounds(
        L.latLngBounds(bounds),
        { padding: [35, 35] }
      );
    } else {
      this.map.setView([SHOP_LAT, SHOP_LNG], 14);
    }

    this.routingBusy = false;
    this.cdr.markForCheck();
  }

  confirm() {
    if (this.loading || !this.selected || this.selected.saved) return;
    this.error = '';
    this.loading = true;
    this.api.confirm(this.store.selected.plan_token).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.store.jobs = res.jobs;

        this.store.selected = {
          ...this.store.selected,
          saved: true
        };

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: this.fail
    });
  }
}
//one
