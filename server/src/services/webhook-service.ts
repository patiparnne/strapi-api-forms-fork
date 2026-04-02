import { NotificationType } from '../../../admin/src/utils/types';
import { replaceDynamicVariables } from '../functions';

/**
 * Webhook Service for API Forms Plugin
 */
export default {
  async sendWebhook(notification: NotificationType, submissionData: any) {
    if (!notification.webhookEnabled || !notification.webhookUrl) {
      strapi.log.info('Webhook is not enabled or URL is not configured.');
      return;
    }

    try {
      // Parse headers
      let headers = {};
      if (notification.webhookHeaders) {
        try {
          headers = JSON.parse(notification.webhookHeaders);
        } catch (error) {
          strapi.log.error('Failed to parse webhook headers:', error);
          headers = { 'Content-Type': 'application/json' };
        }
      } else {
        headers = { 'Content-Type': 'application/json' };
      }

      // Prepare request body
      let body = null;
      if (notification.webhookMethod === 'POST' && notification.webhookBody) {
        try {
          // Replace dynamic variables in the body template
          const bodyTemplate = replaceDynamicVariables(notification.webhookBody, submissionData);
          body = bodyTemplate;
        } catch (error) {
          strapi.log.error('Failed to process webhook body:', error);
          body = JSON.stringify({
            message: 'Form submitted',
            data: submissionData,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: notification.webhookMethod || 'POST',
        headers,
      };

      if (body && notification.webhookMethod === 'POST') {
        fetchOptions.body = body;
      }

      strapi.log.info(`Sending webhook to ${notification.webhookUrl}`);
      
      const response = await fetch(notification.webhookUrl, fetchOptions);

      if (!response.ok) {
        throw new Error(`Webhook request failed with status: ${response.status}`);
      }

      strapi.log.info('Webhook sent successfully.');
      
    } catch (error) {
      strapi.log.error('Webhook sending failed:', error);
      throw error;
    }
  },
};