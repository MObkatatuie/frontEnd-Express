import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Rider } from './rider';

describe('Rider', () => {
  let component: Rider;
  let fixture: ComponentFixture<Rider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rider],
    }).compileComponents();

    fixture = TestBed.createComponent(Rider);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
