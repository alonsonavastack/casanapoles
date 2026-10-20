import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Rutas con # (…/#/admin): cPanel no necesita reglas de reescritura.
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withFetch()),
  ],
};
