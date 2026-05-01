// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// WizardStepper — horizontal step indicator for multi-step workflows.
// Location: apps/frontend/src/app/shared/components/wizard-stepper/wizard-stepper.component.ts
//
// Three states per step (from Wizard exemplar):
//   - complete  — green checkmark + green connector line
//   - active    — brand-primary filled circle + step number
//   - upcoming  — grey circle + step number (click disabled)
//
// Click navigation enabled only for completed steps and the current step's
// immediate predecessors — never for upcoming steps.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';

export interface WizardStep<TId extends string = string> {
  id: TId;
  order: number;
  title: string;
  description?: string;
  icon?: string;
}

export type WizardStepStatus = 'complete' | 'active' | 'upcoming';

@Component({
  selector: 'app-wizard-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonIcon],
  template: `
    <nav class="wizard-stepper" role="navigation" [attr.aria-label]="ariaLabel()">
      <ol class="stepper-list">
        @for (step of steps(); track step.id; let i = $index) {
          <li
            class="stepper-item"
            [class.complete]="getStatus(step.id) === 'complete'"
            [class.active]="getStatus(step.id) === 'active'"
            [class.upcoming]="getStatus(step.id) === 'upcoming'">
            <button
              type="button"
              class="stepper-btn"
              [disabled]="!isClickable(step.id)"
              (click)="onStepClick(step.id)"
              [attr.aria-current]="getStatus(step.id) === 'active' ? 'step' : null"
              [attr.aria-label]="stepAriaLabel(step)">
              <span class="stepper-indicator">
                @if (getStatus(step.id) === 'complete') {
                  <ion-icon name="checkmark" aria-hidden="true"></ion-icon>
                } @else {
                  <span class="stepper-number">{{ step.order }}</span>
                }
              </span>
              <span class="stepper-label">
                <span class="stepper-title">{{ step.title }}</span>
                @if (step.description) {
                  <span class="stepper-desc">{{ step.description }}</span>
                }
              </span>
            </button>
            @if (i < steps().length - 1) {
              <span class="stepper-connector" aria-hidden="true"></span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [`
    :host {
      display: block;
    }

    .wizard-stepper {
      padding: var(--finops-space-5) var(--finops-space-6);
      background: var(--finops-bg-surface);
      border: 1px solid var(--finops-border-default);
      border-radius: var(--finops-radius-lg);
      box-shadow: var(--finops-shadow-sm);
      overflow-x: auto;
    }

    .wizard-stepper::-webkit-scrollbar {
      height: 0;
    }

    .stepper-list {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
      gap: 0;
      min-width: max-content;
    }

    .stepper-item {
      display: flex;
      align-items: flex-start;
      position: relative;
      flex: 1;
      min-width: 0;
    }

    .stepper-btn {
      display: flex;
      align-items: flex-start;
      gap: var(--finops-space-3);
      padding: var(--finops-space-1);
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      font-family: var(--finops-font-family);
      width: 100%;
      transition: var(--finops-transition-default);
    }

    .stepper-btn:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .stepper-btn:not(:disabled):hover .stepper-title {
      color: var(--finops-text-primary);
    }

    .stepper-btn:focus-visible {
      outline: 2px solid var(--finops-brand-primary);
      outline-offset: 2px;
      border-radius: var(--finops-radius-md);
    }

    .stepper-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: var(--finops-radius-full);
      background: var(--finops-bg-subtle);
      border: 2px solid var(--finops-border-default);
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-sm);
      font-weight: var(--finops-font-semibold);
      color: var(--finops-text-tertiary);
      transition: var(--finops-transition-default);
    }

    .stepper-indicator ion-icon {
      font-size: 18px;
    }

    .stepper-label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 2px;
      min-width: 0;
    }

    .stepper-title {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-sm);
      font-weight: var(--finops-font-semibold);
      color: var(--finops-text-secondary);
      white-space: nowrap;
      transition: var(--finops-transition-default);
    }

    .stepper-desc {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-xs);
      color: var(--finops-text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
    }

    .stepper-connector {
      display: block;
      flex: 1;
      height: 2px;
      background: var(--finops-border-default);
      margin: 16px var(--finops-space-3) 0;
      min-width: 32px;
      transition: var(--finops-transition-default);
    }

    /* Active step */
    .stepper-item.active .stepper-indicator {
      background: var(--finops-brand-primary);
      border-color: var(--finops-brand-primary);
      color: var(--finops-text-inverse);
    }

    .stepper-item.active .stepper-title {
      color: var(--finops-brand-primary);
    }

    /* Completed step */
    .stepper-item.complete .stepper-indicator {
      background: var(--finops-success);
      border-color: var(--finops-success);
      color: var(--finops-text-inverse);
    }

    .stepper-item.complete .stepper-title {
      color: var(--finops-text-primary);
    }

    .stepper-item.complete .stepper-connector {
      background: var(--finops-success);
    }
  `],
})
export class WizardStepperComponent<TId extends string = string> {
  readonly steps = input.required<WizardStep<TId>[]>();
  readonly currentStepId = input.required<TId>();
  readonly completedStepIds = input<TId[]>([]);
  readonly ariaLabel = input<string>('Wizard progress');

  readonly stepClick = output<TId>();

  getStatus(stepId: TId): WizardStepStatus {
    if (this.completedStepIds().includes(stepId)) return 'complete';
    if (this.currentStepId() === stepId) return 'active';
    return 'upcoming';
  }

  isClickable(stepId: TId): boolean {
    const status = this.getStatus(stepId);
    // Click allowed for completed steps (to jump back for editing) and the active step.
    // Upcoming steps are not clickable — the only path forward is via the Continue button
    // so per-step validation runs.
    return status === 'complete' || status === 'active';
  }

  onStepClick(stepId: TId) {
    if (!this.isClickable(stepId)) return;
    this.stepClick.emit(stepId);
  }

  stepAriaLabel(step: WizardStep<TId>): string {
    const total = this.steps().length;
    const status = this.getStatus(step.id);
    const parts = [
      `Step ${step.order} of ${total}`,
      step.title,
      status,
    ];
    return parts.join(', ');
  }
}
