import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-grid-shell-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid-card" [class.span-full]="span === 'full'">
      <div class="card-header" *ngIf="title">
        <h3>{{ title }}</h3>
        <span class="subtitle" *ngIf="subtitle">{{ subtitle }}</span>
      </div>
      <div class="card-body"><ng-content></ng-content></div>
    </div>
  `,
  styles: [`.grid-card { background: var(--finops-surface-primary, #fff); border-radius: 12px;
    border: 1px solid var(--finops-border-default, #e0e0e0); padding: 20px; }
    .span-full { grid-column: 1 / -1; }
    .card-header h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
    .subtitle { font-size: 13px; color: var(--finops-text-tertiary); }`]
})
export class GridShellCardComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() span: 'default' | 'full' = 'default';
}
