import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const BASE = 'https://express-api-7ar9.onrender.com/api';

@Injectable({ providedIn: 'root' })
export class Api {
    private http = inject(HttpClient);
    customers() { return this.http.get<any>(`${BASE}/customers`); }
    orders() { return this.http.get<any>(`${BASE}/orders`); }
    mock(count = 25) { return this.http.post<any>(`${BASE}/orders/mock?count=${count}`, {}); }
    clearMock() { return this.http.delete<any>(`${BASE}/orders/mock`); }
    addBox(id: number) { return this.http.post<any>(`${BASE}/orders/${id}/boxes`, { amount: 1 }); }
    removeBox(id: number) { return this.http.delete<any>(`${BASE}/orders/${id}/boxes?amount=1`); }
    plans() { return this.http.post<any>(`${BASE}/dispatch/plans?count=1`, {}); }
    confirm(token: string) { return this.http.post<any>(`${BASE}/dispatch/confirm`, { plan_token: token }); }
    job(code: string) { return this.http.get<any>(`${BASE}/jobs/${code}`); }
    //customer
    searchCustomers(q: string) { return this.http.get<any>(`${BASE}/customers/search`, { params: { q } }); }
    nearbyCustomers(lat: number, lng: number) {
        return this.http.get<any>(`${BASE}/customers/nearby`, { params: { lat, lng } });
    }
    addCustomer(c: any) { return this.http.post<any>(`${BASE}/customers`, c); }
    updateCustomer(id: number, c: any) { return this.http.put<any>(`${BASE}/customers/${id}`, c); }
    deleteCustomer(id: number) { return this.http.delete<any>(`${BASE}/customers/${id}`); }

    //current plan
    current() { return this.http.get<any>(`${BASE}/dispatch/current`); }

    //order
    addOrder(customer_id: number, quantity_boxes: number) {
        return this.http.post<any>(`${BASE}/orders`, { customer_id, quantity_boxes });
    }
    updateOrder(id: number, quantity_boxes: number) {
        return this.http.put<any>(`${BASE}/orders/${id}`, { quantity_boxes });
    }
    deleteOrder(id: number) { return this.http.delete<any>(`${BASE}/orders/${id}`); }
    deleteReal() { return this.http.delete<any>(`${BASE}/orders/real`); }
    nearbyOrders(lat: number, lng: number) {
        return this.http.get<any>(`${BASE}/orders/nearby`, { params: { lat, lng } });
    }
}