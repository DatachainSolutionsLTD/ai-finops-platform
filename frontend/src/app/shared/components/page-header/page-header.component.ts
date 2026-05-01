// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// PageHeader — required on every screen.
// Location: apps/frontend/src/app/shared/components/page-header/page-header.component.ts
//
// Provides title, subtitle, optional breadcrumb, and three content projection slots:
//   - [slot=actions] — right-aligned action buttons, TimeRangeSelector, etc.
//   - [slot=meta]    — below subtitle for contextual chips, attribution, status
//   - [slot=tabs]    — below meta for segmented controls (rare — tab nav is usually a separate component)
//
// Usage validated by all 4 exemplars:
//   Dashboard: TimeRangeSelector in actions slot
//   List: Export + Add primary button in actions slot
//   Detail/Edit: tier chip + last-edited attribution in meta slot
//   Wizard: Save & Exit + Cancel in actions slot
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';

export interface Breadcrumb {
  label: string;
  url?: string;                // url omitted for the current page (last crumb)
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, IonIcon],
  template: `
    <header class="page-header" [class.with-breadcrumb]="breadcrumbs().length > 0">
      <div class="page-header-main">
        @if (breadcrumbs().length > 0) {
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <ol>
              @for (crumb of breadcrumbs(); track crumb.label; let last = $last) {
                <li class="breadcrumb-item" [class.current]="last">
                  @if (crumb.url && !last) {
                    <a [routerLink]="crumb.url" class="breadcrumb-link">{{ crumb.label }}</a>
                    <ion-icon name="chevron-forward-outline" class="breadcrumb-sep" aria-hidden="true"></ion-icon>
                  } @else {
                    <span class="breadcrumb-current" aria-current="page">{{ crumb.label }}</span>
                  }
                </li>
              }
            </ol>
          </nav>
        }

        <div class="page-header-top">
          <div class="page-header-text">
            <h1 class="page-title">{{ title() }}</h1>
            @if (subtitle()) {
              <p class="page-subtitle">{{ subtitle() }}</p>
            }
          </div>

          <div class="page-header-actions">
            <ng-content select="[slot=actions]"></ng-content>
          </div>
        </div>

        <div class="page-header-meta">
          <ng-content select="[slot=meta]"></ng-content>
        </div>

        <div class="page-header-tabs">
          <ng-content select="[slot=tabs]"></ng-content>
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
    }

    .page-header {
      margin-bottom: var(--finops-space-8);
    }

    .page-header.with-breadcrumb {
      margin-top: calc(-1 * var(--finops-space-2));
    }

    .page-header-main {
      display: flex;
      flex-direction: column;
      gap: var(--finops-space-3);
    }

    .breadcrumb {
      margin-bottom: var(--finops-space-1);
    }

    .breadcrumb ol {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--finops-space-1);
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .breadcrumb-item {
      display: inline-flex;
      align-items: center;
      gap: var(--finops-space-1);
      font-size: var(--finops-text-sm);
      color: var(--finops-text-tertiary);
    }

    .breadcrumb-link {
      color: var(--finops-text-tertiary);
      text-decoration: none;
      transition: var(--finops-transition-default);
    }

    .breadcrumb-link:hover {
      color: var(--finops-brand-primary);
      text-decoration: underline;
    }

    .breadcrumb-sep {
      font-size: 14px;
      color: var(--finops-text-disabled);
    }

    .breadcrumb-current {
      color: var(--finops-text-secondary);
      font-weight: var(--finops-font-medium);
    }

    .page-header-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--finops-space-4);
      flex-wrap: wrap;
    }

    .page-header-text {
      min-width: 0;
      flex: 1;
    }

    .page-title {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-3xl);
      font-weight: var(--finops-font-bold);
      color: var(--finops-text-primary);
      margin: 0;
      letter-spacing: -0.01em;
      line-height: var(--finops-leading-tight);
    }

    .page-subtitle {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-sm);
      color: var(--finops-text-tertiary);
      margin: var(--finops-space-1) 0 0;
      line-height: var(--finops-leading-normal);
    }

    .page-header-actions {
      display: flex;
      gap: var(--finops-space-3);
      align-items: center;
      flex-shrink: 0;
    }

    .page-header-actions:empty {
      display: none;
    }

    .page-header-meta {
      display: flex;
      gap: var(--finops-space-4);
      align-items: center;
      flex-wrap: wrap;
    }

    .page-header-meta:empty {
      display: none;
    }

    .page-header-tabs {
      margin-top: var(--finops-space-2);
    }

    .page-header-tabs:empty {
      display: none;
    }

    @media (max-width: 768px) {
      .page-header-top {
        flex-direction: column;
        align-items: stretch;
      }

      .page-header-actions {
        width: 100%;
        justify-content: flex-start;
      }

      .page-title {
        font-size: var(--finops-text-2xl);
      }
    }
  `],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly breadcrumbs = input<Breadcrumb[]>([]);
}
