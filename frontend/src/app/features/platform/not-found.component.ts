// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Not Found — 404 screen.
// Route: ** (wildcard catchall)
// Pattern: Special — full-page centered card, NO ion-split-pane / side nav.
//
// Implementation: This component is registered on a route that bypasses the
// AppComponent shell. It renders its own <ion-app> wrapper so the side nav
// does not appear. The route config uses a separate layout:
//
//   { path: '**', component: NotFoundComponent, data: { shell: 'none' } }
//
// AppComponent checks route data.shell and conditionally shows ion-split-pane.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy, Component, inject, signal, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  IonContent, IonButton, IonIcon,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonButton, IonIcon],
  templateUrl: './not-found.component.html',
  styleUrl:    './not-found.component.scss',
})
export class NotFoundComponent {
  readonly #router = inject(Router);
  readonly #route  = inject(ActivatedRoute);
  readonly #title  = inject(Title);

  /** The path the user was trying to reach — shown in the error card. */
  readonly attemptedPath = signal<string>('');

  constructor() {
    this.#title.setTitle('Page not found · FinOps');
    // Capture the attempted URL from the router state
    const url = this.#router.url;
    this.attemptedPath.set(url && url !== '/not-found' ? url : '');
  }

  goHome()    { void this.#router.navigate(['/']); }
  goBack()    { history.back(); }
  goSupport() { void this.#router.navigate(['/admin/support']); }
}
