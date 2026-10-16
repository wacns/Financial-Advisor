import '@ionic/core/css/core.css';
import { initialize } from '@ionic/core/components';
import { defineCustomElement as app } from '@ionic/core/components/ion-app';
import { defineCustomElement as button } from '@ionic/core/components/ion-button';
import { defineCustomElement as tabBar } from '@ionic/core/components/ion-tab-bar';
import { defineCustomElement as tabButton } from '@ionic/core/components/ion-tab-button';
import { defineCustomElement as label } from '@ionic/core/components/ion-label';

initialize({hardwareBackButton: false, inputShims: false});
[app, button, tabBar, tabButton, label].forEach(define => define());
