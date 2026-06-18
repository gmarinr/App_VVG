import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  home, homeOutline, time, timeOutline, addCircle, addCircleOutline, add, addOutline,
  chatbubbles, chatbubblesOutline, person, personOutline, personCircle, people, peopleOutline,
  personAdd, personAddOutline, airplane, airplaneOutline, beer, beerOutline, wallet, walletOutline,
  card, cash, camera, image, images, settings, settingsOutline, arrowBack, send, sendOutline,
  checkmarkCircle, ellipse, trash, trashOutline, create, createOutline, logOut, logOutOutline,
  link, calendar, calendarOutline, pricetag, pricetagOutline, chevronForward, close, closeCircle,
  refresh, statsChart, swapHorizontal, flag, flagOutline, arrowUp, arrowDown, checkmark,
  searchOutline, ellipsisHorizontal, receiptOutline, walkOutline,
} from 'ionicons/icons';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Registro global de íconos para que <ion-icon name="..."> funcione en toda la app.
addIcons({
  home, 'home-outline': homeOutline, time, 'time-outline': timeOutline,
  'add-circle': addCircle, 'add-circle-outline': addCircleOutline, add, 'add-outline': addOutline,
  chatbubbles, 'chatbubbles-outline': chatbubblesOutline, person, 'person-outline': personOutline,
  'person-circle': personCircle, people, 'people-outline': peopleOutline,
  'person-add': personAdd, 'person-add-outline': personAddOutline,
  airplane, 'airplane-outline': airplaneOutline, beer, 'beer-outline': beerOutline,
  wallet, 'wallet-outline': walletOutline, card, cash, camera, image, images,
  settings, 'settings-outline': settingsOutline, 'arrow-back': arrowBack, send, 'send-outline': sendOutline,
  'checkmark-circle': checkmarkCircle, ellipse, trash, 'trash-outline': trashOutline,
  create, 'create-outline': createOutline, 'log-out': logOut, 'log-out-outline': logOutOutline,
  link, calendar, 'calendar-outline': calendarOutline, pricetag, 'pricetag-outline': pricetagOutline,
  'chevron-forward': chevronForward, close, 'close-circle': closeCircle, refresh,
  'stats-chart': statsChart, 'swap-horizontal': swapHorizontal, flag, 'flag-outline': flagOutline,
  'arrow-up': arrowUp, 'arrow-down': arrowDown, checkmark, 'search-outline': searchOutline,
  'ellipsis-horizontal': ellipsisHorizontal, 'receipt-outline': receiptOutline, 'walk-outline': walkOutline,
});

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'ios' }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});
