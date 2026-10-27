import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RoadMap } from './road-map';
import { Dispatch } from './dispatch/dispatch';
import { Api } from './api';
import * as L from 'leaflet';

vi.mock('leaflet', () => {
  const layer = () => ({ addTo: vi.fn().mockReturnThis(), remove: vi.fn(), bindTooltip: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis() });
  return {
    map: vi.fn(() => ({ setView: vi.fn().mockReturnThis(), fitBounds: vi.fn(), remove: vi.fn() })),
    tileLayer: vi.fn(layer), layerGroup: vi.fn(layer), circleMarker: vi.fn(layer), polyline: vi.fn(layer),
    marker: vi.fn(layer), divIcon: vi.fn(options => options),
    latLngBounds: vi.fn(points => points),
  };
});

describe('Road maps', () => {
  it('draws server geometry in lat/lng order, fits detours and removes the map', async () => {
    await TestBed.configureTestingModule({ imports: [RoadMap] }).compileComponents();
    const fixture = TestBed.createComponent(RoadMap);
    const path: [number, number][] = [[16.24486, 103.24784], [16.25, 103.27], [16.24, 103.26]];
    fixture.componentRef.setInput('path', path);
    fixture.componentRef.setInput('stops', [{ seq: 1, customer_name: '<img src=x>', latitude: 16.24, longitude: 103.26 }]);
    fixture.detectChanges();
    expect(L.polyline).toHaveBeenCalledWith(path, expect.objectContaining({ weight: 5 }));
    expect(L.latLngBounds).toHaveBeenCalledWith(expect.arrayContaining([[16.25, 103.27]]));
    const markers = vi.mocked(L.circleMarker).mock.results;
    const popup = markers[markers.length - 1]!.value.bindPopup.mock.calls[0][0] as HTMLElement;
    expect(popup.textContent).toContain('<img src=x>');
    expect(popup.querySelector('img')).toBeNull();
    const map = vi.mocked(L.map).mock.results[0]!.value;
    fixture.destroy();
    expect(map.remove).toHaveBeenCalled();
  });

  it('auto-selects a road plan, recalculates, handles errors and confirms the exact token', async () => {
    const route = { rider: {rider_id:1,name:'Rider',color:'#123456'}, path:[[16.24,103.24],[16.25,103.26],[16.23,103.25]], distance_km:2.5, time_min:8,
      stops:[1,2].map(id=>({order_id:id,seq:id,boxes:1,eta:'11:38',customer:{name:'Test',latitude:16.23,longitude:103.25}})), money:{profit:20} };
    const plan = {plan_token:'token-1',label:'แผนแนะนำ',summary:{profit:20},routes:[route]};
    const api = {current:vi.fn(()=>throwError(()=>({status:404}))), plans:vi.fn(()=>of({plans:[plan]})), confirm:vi.fn((_token: string)=>of({jobs:[]}))};
    await TestBed.configureTestingModule({imports:[Dispatch],providers:[{provide:Api,useValue:api}]}).compileComponents();
    const fixture=TestBed.createComponent(Dispatch);
    fixture.detectChanges();
    fixture.componentInstance.calculate();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected.plan_token).toBe('token-1');
    expect(L.polyline).toHaveBeenCalledWith(route.path,expect.anything());
    const markerCalls = vi.mocked(L.marker).mock.calls;
    expect(markerCalls.length).toBeGreaterThanOrEqual(2);
    expect(markerCalls[markerCalls.length - 1]![0]).not.toEqual(markerCalls[markerCalls.length - 2]![0]);
    expect(fixture.componentInstance.routeMetrics['1']?.distanceKm).toBe(2.5);
    expect(fixture.nativeElement.textContent).toContain('คำนวณใหม่');
    expect(fixture.nativeElement.textContent).not.toContain('แผน 1:');
    const secondRoute = {...route, rider:{rider_id:2,name:'Rider 2',color:'#654321'},
      path:[[16.24,103.24],[16.28,103.29]], stops:[{...route.stops[0],order_id:3}]};
    fixture.componentInstance.select({...plan,routes:[route,secondRoute]});
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.rider-card') as NodeListOf<HTMLElement>;
    vi.mocked(L.polyline).mockClear();
    vi.mocked(L.marker).mockClear();
    cards[0]!.click();
    fixture.detectChanges();
    expect(L.polyline).toHaveBeenCalledTimes(1);
    expect(L.polyline).toHaveBeenCalledWith(route.path,expect.anything());
    expect(L.marker).toHaveBeenCalledTimes(2);
    expect(cards[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.componentInstance.routeMetrics['2']?.distanceKm).toBe(2.5);
    fixture.componentInstance.drawPlan(fixture.componentInstance.selected);
    expect(fixture.componentInstance.focusedRiderId).toBe(1);
    vi.mocked(L.polyline).mockClear();
    cards[1]!.click();
    expect(L.polyline).toHaveBeenCalledTimes(1);
    expect(L.polyline).toHaveBeenCalledWith(secondRoute.path,expect.anything());
    vi.mocked(L.polyline).mockClear();
    cards[1]!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    expect(fixture.componentInstance.focusedRiderId).toBeNull();
    expect(L.polyline).toHaveBeenCalledTimes(2);
    cards[0]!.click();
    fixture.componentInstance.calculate();
    expect(fixture.componentInstance.focusedRiderId).toBeNull();
    expect(api.plans).toHaveBeenCalledTimes(2);
    api.plans.mockImplementation(()=>throwError(()=>({error:{error:'บริการเส้นทางไม่พร้อม'}})));
    fixture.componentInstance.calculate();
    expect(fixture.componentInstance.error).toBe('บริการเส้นทางไม่พร้อม');
    expect(fixture.componentInstance.loading).toBe(false);
    expect(fixture.componentInstance.calculating).toBe(false);
    fixture.componentInstance.confirm();
    expect(api.confirm).toHaveBeenCalledWith('token-1');
    expect(fixture.componentInstance.selected.saved).toBe(true);
    fixture.destroy();
  });
});
