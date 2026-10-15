import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import * as L from 'leaflet';
import { Api } from '../api';
import { DispatchStore } from '../dispatch/dispatch-store';

const SHOP: L.LatLngExpression = [16.24486, 103.24784];

@Component({
  selector: 'app-orders',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
})
export class Orders implements AfterViewInit, OnDestroy {
  private api = inject(Api);
  private cdr = inject(ChangeDetectorRef);
  private dispatchStore = inject(DispatchStore);
  private map!: L.Map;
  private markers = L.layerGroup();
  private ring?: L.Circle;
  private point?: { lat: number; lng: number };

  orders: any[] = [];
  customers: any[] = [];
  totalBoxes = 0;
  mode = 'ทั้งหมด';
  mockCount = 25;
  newCustomerId: number | null = null;
  newBoxes = 1;
  message = '';
  error = '';
  busy = false;

  ngAfterViewInit() {
    this.map = L.map('omap').setView(SHOP, 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(this.map);
    L.circleMarker(SHOP, { radius: 9, color: '#111', fillOpacity: 1 }).bindPopup('ร้าน').addTo(this.map);
    this.markers.addTo(this.map);

    // คลิกแผนที่ = เลือกจุดสำหรับค้นในรัศมี 2 กม.
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.point = { lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) };
      this.ring?.remove();
      this.ring = L.circle(e.latlng, { radius: 2000, color: '#f59e0b', fillOpacity: 0.08 }).addTo(this.map);
      this.cdr.markForCheck();
    });

    this.api.customers().subscribe(r => { this.customers = r.data; this.cdr.markForCheck(); });
    this.load();
  }

  ngOnDestroy() { this.map?.remove(); }

  get pointText() { return this.point ? `${this.point.lat}, ${this.point.lng}` : 'ยังไม่ได้เลือก'; }

  private show(list: any[], mode: string) {
    this.orders = list;
    this.mode = mode;
    this.totalBoxes = list.reduce((s, o) => s + o.quantity_boxes, 0);
    this.markers.clearLayers();
    for (const o of list) {
      L.circleMarker([o.customer.latitude, o.customer.longitude],
        { radius: 5 + o.quantity_boxes * 2, color: o.is_mock ? '#8e24aa' : '#e53935', fillOpacity: 0.7 })
        .bindPopup(`#${o.order_id} ${o.customer.first_name} ${o.customer.last_name} · ${o.quantity_boxes} กล่อง`)
        .addTo(this.markers);
    }
    this.busy = false;
    this.cdr.markForCheck();
  }

  private ok = (msg: string) => () => {
    this.message = msg;
    this.error = '';
    // ออเดอร์เปลี่ยน → แผนที่คำนวณไว้แต่ยังไม่ยืนยันใช้ไม่ได้แล้ว
    if (!this.dispatchStore.selected?.saved) { this.dispatchStore.plans = []; this.dispatchStore.selected = null; }
    this.load();
  };

  private fail = (err: any) => {
    this.error = err.error?.error ?? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
    this.message = '';
    this.busy = false;
    this.cdr.markForCheck();
  };

  load() {
    this.busy = true;
    this.ring?.remove();
    this.point = undefined;
    this.api.orders().subscribe({ next: r => this.show(r.data, 'ทั้งหมด'), error: this.fail });
  }

  nearby() {
    if (!this.point) { this.error = 'คลิกบนแผนที่เพื่อเลือกจุดก่อน'; return; }
    this.busy = true;
    this.api.nearbyOrders(this.point.lat, this.point.lng)
      .subscribe({ next: r => this.show(r.data, 'ในรัศมี 2 กม.'), error: this.fail });
  }

  mock() {
    this.busy = true;
    this.api.mock(this.mockCount).subscribe({ next: this.ok(`จำลองออเดอร์ ${this.mockCount} รายการแล้ว`), error: this.fail });
  }

  clearMock() {
    if (!confirm('ล้างออเดอร์จำลองทั้งหมด?')) return;
    this.busy = true;
    this.api.clearMock().subscribe({ next: this.ok('ล้างออเดอร์จำลองแล้ว'), error: this.fail });
  }

  deleteReal() {
    if (!confirm('ลบออเดอร์ที่ไม่ใช่ข้อมูลจำลองทั้งหมด?')) return;
    this.busy = true;
    this.api.deleteReal().subscribe({ next: this.ok('ลบออเดอร์จริงทั้งหมดแล้ว'), error: this.fail });
  }

  add() {
    if (!this.newCustomerId) { this.error = 'เลือกลูกค้าก่อน'; return; }
    this.busy = true;
    this.api.addOrder(this.newCustomerId, this.newBoxes)
      .subscribe({ next: this.ok('เพิ่มออเดอร์แล้ว'), error: this.fail });
  }

  plus(o: any) { this.api.addBox(o.order_id).subscribe({ next: this.ok(`ออเดอร์ #${o.order_id} +1 กล่อง`), error: this.fail }); }
  minus(o: any) { this.api.removeBox(o.order_id).subscribe({ next: this.ok(`ออเดอร์ #${o.order_id} -1 กล่อง`), error: this.fail }); }
  setBoxes(o: any, n: number) {
    this.api.updateOrder(o.order_id, +n).subscribe({ next: this.ok(`ออเดอร์ #${o.order_id} เป็น ${n} กล่อง`), error: this.fail });
  }
  remove(o: any) {
    if (!confirm(`ลบออเดอร์ #${o.order_id}?`)) return;
    this.api.deleteOrder(o.order_id).subscribe({ next: this.ok(`ลบออเดอร์ #${o.order_id} แล้ว`), error: this.fail });
  }
}