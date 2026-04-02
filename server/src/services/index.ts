import notification from './notification';
import form from './form';
import submission from './submission';
import emailService from './email-service';
import webhookService from './webhook-service';

export default {
  form,
  submission,
  notification,
  emailService,
  'webhook-service': webhookService,
};
