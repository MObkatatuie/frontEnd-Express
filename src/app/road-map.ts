import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-road-map',
  template: '<div #canvas class="h-80 rounded-xl border border-gray-200" aria-label="แผนที่เส้นทางจัดส่งตามถนน"></div>',
})
export class RoadMap implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLDivElement>;
  @Input() path: [number, number][] = [];
  @Input() stops: { latitude: number; longitude: number; seq: number; customer_name: string }[] = [];
  @Input() color = '#2563eb';
  @Input() shop = { lat: 16.24486, lng: 103.24784 };
  private map?: L.Map;
  private layer?: L.LayerGroup;

  ngAfterViewInit() {
    this.map = L.map(this.canvas.nativeElement).setView([this.shop.lat, this.shop.lng], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors · Routing: OSRM',
    }).addTo(this.map);
    this.draw();
  }
  ngOnChanges() { this.draw(); }
  ngOnDestroy() { this.map?.remove(); }
  private draw() {
    if (!this.map) return;
    this.layer?.remove();
    this.layer = L.layerGroup().addTo(this.map);
    const origin: L.LatLngTuple = [this.shop.lat, this.shop.lng];
    L.circleMarker(origin, { radius: 8, color: '#111', fillOpacity: 1 }).bindTooltip('ร้าน').addTo(this.layer);
    const bounds: L.LatLngExpression[] = [origin];
    if (this.path?.length >= 2) {
      L.polyline(this.path, { color: this.color, weight: 5 }).addTo(this.layer);
      bounds.push(...this.path);
    }
    for (const s of this.stops) {
      const point: L.LatLngTuple = [s.latitude, s.longitude];
      const popup = document.createElement('span');
      popup.textContent = `จุดที่ ${s.seq}: ${s.customer_name}`;
      L.circleMarker(point, { radius: 7, color: this.color, fillOpacity: 1 })
        .bindTooltip(String(s.seq), { permanent: true, direction: 'top' })
        .bindPopup(popup).addTo(this.layer);
      bounds.push(point);
    }
    this.map.fitBounds(L.latLngBounds(bounds), { padding: [25, 25], maxZoom: 16 });
  }
}
