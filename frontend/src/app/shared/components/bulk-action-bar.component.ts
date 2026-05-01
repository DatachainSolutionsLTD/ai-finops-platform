import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

export interface BulkAction {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-bulk-action-bar',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon],
  template: `
    <div class="bulk-bar" *ngIf="selectedCount > 0">
      <span class="count">{{ selectedCount }} selected</span>
      <ion-button *ngFor="let a of actions" [color]="a.color || 'primary'" size="small"
                  [disabled]="a.disabled" (click)="actionClicked.emit(a.id)">
        <ion-icon *ngIf="a.icon" [name]="a.icon" slot="start"></ion-icon>
        {{ a.label }}
      </ion-button>
    </div>
  `,
  styles: [`.bulk-bar { display: flex; align-items: center; gap: 8px; padding: 8px 16px;
    background: var(--finops-surface-secondary, #f5f5f5); border-radius: 8px; }
    .count { font-weight: 600; margin-right: 8px; }`]
})
export class BulkActionBarComponent {
  @Input() selectedCount = 0;
  @Input() actions: BulkAction[] = [];
  @Output() actionClicked = new EventEmitter<string>();
}
