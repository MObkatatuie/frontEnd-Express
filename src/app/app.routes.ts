import { Routes } from '@angular/router';
import { ShopLayout } from './shop-layout/shop-layout';
import { Customers } from './customers/customers';
import { Orders } from './orders/orders';
import { Dispatch } from './dispatch/dispatch';
import { Rider } from './rider/rider';

export const routes: Routes = [
  // ฝั่งไรเดอร์: ไม่มีเมนูร้าน
  { path: 'rider', component: Rider },

  // ฝั่งร้าน: มีเมนูด้านบน
  {
    path: '',
    component: ShopLayout,
    children: [
      { path: '', redirectTo: 'dispatch', pathMatch: 'full' },
      { path: 'customers', component: Customers },
      { path: 'orders', component: Orders },
      { path: 'dispatch', component: Dispatch },
    ],
  },

  { path: '**', redirectTo: '' },
];