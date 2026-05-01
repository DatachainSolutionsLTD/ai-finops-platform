import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { SummaryStat } from './summary-stat-row.component';

@Component({
  selector: 'app-summary-stat-row',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-row">
      <div class="stat" *ngFor="let s of stats">
        <span class="stat-label">{{ s.label }}</span>
        <span class="stat-value">{{ s.value }}</span>
      </div>
    </div>
  `,
  styles: [`.stat-row { display: flex; gap: 24px; flex-wrap: wrap; }
    .stat { display: flex; flex-direction: column; }
    .stat-label { font-size: 12px; color: var(--finops-text-tertiary); }
    .stat-value { font-size: 20px; font-weight: 600; }`]
})
export class SummaryStatRowComponent {
  @Input() stats: SummaryStat[] = [];
  @Input() columns: number = 4;
}
