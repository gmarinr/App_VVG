import { Component } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';

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
    `,
  ],
})
export class TabsPage {}
