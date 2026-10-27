
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RoadRoute {
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][];
}

interface OsrmResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
    };
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class RoadRoutingService {
  private readonly baseUrl =
    'https://router.project-osrm.org/route/v1/driving';

  constructor(private http: HttpClient) {}

  async route(points: RoutePoint[]): Promise<RoadRoute> {
    if (points.length < 2) {
      throw new Error('ต้องมีพิกัดอย่างน้อย 2 จุด');
    }

    for (const p of points) {
      if (
        !Number.isFinite(p.lat) ||
        !Number.isFinite(p.lng) ||
        p.lat < -90 ||
        p.lat > 90 ||
        p.lng < -180 ||
        p.lng > 180
      ) {
        throw new Error('พิกัดต้นทางหรือปลายทางไม่ถูกต้อง');
      }
    }

    const allCoordinates: [number, number][] = [];
    let totalDistanceKm = 0;
    let totalDurationMin = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];

      let segmentCoordinates: [number, number][];
      let segmentDistanceKm: number;
      let segmentDurationMin: number;

      try {
        const url =
          `${this.baseUrl}/` +
          `${from.lng},${from.lat};${to.lng},${to.lat}` +
          '?overview=full&geometries=geojson&steps=false';

        const response = await firstValueFrom(
          this.http.get<OsrmResponse>(url)
        );

        const road = response.routes?.[0];

        if (
          response.code !== 'Ok' ||
          !road?.geometry?.coordinates?.length
        ) {
          throw new Error('ไม่พบเส้นทางถนน');
        }

        const roadCoordinates =
          road.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );

        // เพิ่มพิกัดจริงของหมุดไว้ทั้งต้นทางและปลายทาง
        // เพื่อเชื่อมเส้นถนนที่ OSRM ปรับพิกัดแล้วกลับไปยังหมุด
        segmentCoordinates = [
          [from.lat, from.lng],
          ...roadCoordinates,
          [to.lat, to.lng]
        ];

        // รวมระยะเส้นตรงเชื่อมหมุดกับถนนด้วย
        segmentDistanceKm =
          road.distance / 1000 +
          this.haversineKm(from, {
            lat: roadCoordinates[0][0],
            lng: roadCoordinates[0][1]
          }) +
          this.haversineKm(
            {
              lat: roadCoordinates[roadCoordinates.length - 1][0],
              lng: roadCoordinates[roadCoordinates.length - 1][1]
            },
            to
          );

        segmentDurationMin = road.duration / 60;
      } catch {
        // ถ้าหาถนนไม่ได้ ให้ลากเส้นตรงถึงหมุดถัดไป
        segmentCoordinates = [
          [from.lat, from.lng],
          [to.lat, to.lng]
        ];

        segmentDistanceKm = this.haversineKm(from, to);
        segmentDurationMin = 0;
      }

      // ป้องกันพิกัดต้นช่วงซ้ำกับปลายช่วงก่อนหน้า
      if (allCoordinates.length > 0) {
        segmentCoordinates = segmentCoordinates.slice(1);
      }

      allCoordinates.push(...segmentCoordinates);
      totalDistanceKm += segmentDistanceKm;
      totalDurationMin += segmentDurationMin;
    }

    return {
      coordinates: allCoordinates,
      distanceKm: totalDistanceKm,
      durationMin: totalDurationMin
    };
  }

  private haversineKm(
    a: RoutePoint,
    b: RoutePoint
  ): number {
    const toRad = (degrees: number) =>
      degrees * Math.PI / 180;

    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const deltaLat = toRad(b.lat - a.lat);
    const deltaLng = toRad(b.lng - a.lng);

    const h =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

    return 6371 * 2 * Math.atan2(
      Math.sqrt(h),
      Math.sqrt(1 - h)
    );
  }
}
