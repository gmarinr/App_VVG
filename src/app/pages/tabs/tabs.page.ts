import { Component } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';

// Shell de navegación principal con footer de 5 secciones.
@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="inicio">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Inicio</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="historial">
          <ion-icon name="time-outline"></ion-icon>
          <ion-label>Historial</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="crear">
          <ion-icon name="add-circle"></ion-icon>
          <ion-label>Agregar</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="mensajes">
          <ion-icon name="chatbubbles-outline"></ion-icon>
          <span class="unread-dot" [class.show]="hasUnreadMessages"></span>
          <ion-label>Mensajes</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="cuenta">
          <ion-icon name="person-outline"></ion-icon>
          <ion-label>Cuenta</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [
    `
      ion-tab-button[tab='crear'] ion-icon {
        font-size: 32px;
        color: var(--ion-color-primary);
      }

      ion-tab-button[tab='mensajes'] {
        position: relative;
      }

      .unread-dot {
        position: absolute;
        top: 7px;
        left: calc(50% + 7px);
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--ion-color-danger);
        border: 2px solid var(--ion-tab-bar-background, #fff);
        opacity: 0;
        transform: scale(0.5);
        transition: opacity 120ms ease, transform 120ms ease;
      }

      .unread-dot.show {
        opacity: 1;
        transform: scale(1);
      }
    `,
  ],
})
export class TabsPage {
  constructor(private auth: AuthService, private data: DataService) {}

  get hasUnreadMessages(): boolean {
    const userId = this.auth.userId;
    return userId ? this.data.unreadChatCount(userId) > 0 : false;
  }
}
