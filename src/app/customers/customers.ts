import { Component, AfterViewInit, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { Api } from '../api';

const SHOP: L.LatLngExpression = [16.24486, 103.24784];
const empty = () => ({ first_name: '', last_name: '', phone: '', address: '', latitude: null as number | null, longitude: null as number | null });

@Component({
  selector: 'app-customers',
  imports: [FormsModule],
  templateUrl: './customers.html',
  styleUrl: './customers.css',
})
export class Customers implements AfterViewInit {
  private api = inject(Api);
  private cdr = inject(ChangeDetectorRef);
  private map!: L.Map;
  private markers = L.layerGroup();
  private picked?: L.CircleMarker;
  private ring?: L.Circle;

  customers: any[] = [];
  form = empty();
  editingId: number | null = null;
  q = '';
  mode = 'ทั้งหมด';
  error = '';

  ngAfterViewInit() {
    this.map = L.map('cmap').setView(SHOP, 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(this.map);
    L.circleMarker(SHOP, { radius: 9, color: '#111', fillOpacity: 1 }).bindPopup('ร้าน').addTo(this.map);
    this.markers.addTo(this.map);

    // คลิกบนแผนที่ = เลือกพิกัดบ้าน (ใส่ในฟอร์ม)
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.form.latitude = +e.latlng.lat.toFixed(6);
      this.form.longitude = +e.latlng.lng.toFixed(6);
      this.showPicked();
      this.cdr.markForCheck();
    });
    this.load();
  }

  private show(list: any[], mode: string) {
    this.customers = list;
    this.mode = mode;
    this.error = '';
    this.markers.clearLayers();
    for (const c of list) {
      L.circleMarker([c.latitude, c.longitude], { radius: 7, color: '#1e88e5', fillOpacity: 0.9 })
        .bindPopup(`${c.first_name} ${c.last_name}<br>${c.phone ?? ''}`)
        .on('click', () => { this.edit(c); this.cdr.markForCheck(); })
        .addTo(this.markers);
    }
    this.cdr.markForCheck();
  }

  private fail = (err: any) => { this.error = err.error?.error ?? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'; this.cdr.markForCheck(); };

  load() {
    this.ring?.remove();
    this.api.customers().subscribe({ next: r => this.show(r.data, 'ทั้งหมด'), error: this.fail });
  }

  search() {
    if (!this.q.trim()) return this.load();
    this.api.searchCustomers(this.q.trim()).subscribe({ next: r => this.show(r.data, `ค้นหา "${this.q}"`), error: this.fail });
  }

  nearby() {
    const { latitude, longitude } = this.form;
    if (latitude == null || longitude == null) { this.error = 'คลิกบนแผนที่เพื่อเลือกจุดก่อน'; return; }
    this.ring?.remove();
    this.ring = L.circle([latitude, longitude], { radius: 1000, color: '#f59e0b', fillOpacity: 0.08 }).addTo(this.map);
    this.api.nearbyCustomers(latitude, longitude)
      .subscribe({ next: r => this.show(r.data, 'ในรัศมี 1 กม.'), error: this.fail });
  }

  edit(c: any) {
    this.editingId = c.customer_id;
    this.form = { first_name: c.first_name, last_name: c.last_name, phone: c.phone ?? '',
                  address: c.address ?? '', latitude: c.latitude, longitude: c.longitude };
    this.showPicked();
  }

  reset() {
    this.editingId = null;
    this.form = empty();
    this.picked?.remove();
  }

  save() {
    const req = this.editingId ? this.api.updateCustomer(this.editingId, this.form) : this.api.addCustomer(this.form);
    req.subscribe({ next: () => { this.reset(); this.load(); }, error: this.fail });
  }

  remove(c: any) {
    if (!confirm(`ลบ ${c.first_name} ${c.last_name}? ออเดอร์ของลูกค้าคนนี้จะถูกลบด้วย`)) return;
    this.api.deleteCustomer(c.customer_id).subscribe({ next: () => this.load(), error: this.fail });
  }

  private showPicked() {
    const { latitude, longitude } = this.form;
    if (latitude == null || longitude == null) return;
    this.picked?.remove();
    this.picked = L.circleMarker([latitude, longitude], { radius: 9, color: '#e53935', fillOpacity: 1 }).addTo(this.map);
  }
}