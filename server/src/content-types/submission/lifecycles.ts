import { errors } from '@strapi/utils';
import { normalizeSubmissionData } from '../../functions';
const { ForbiddenError } = errors;

function getConnectedFormReference(formRelation) {
  const connect = formRelation?.connect;
  const connectedForm = Array.isArray(connect) ? connect[0] : connect;

  if (typeof connectedForm === 'string') {
    return { documentId: connectedForm };
  }

  if (!connectedForm || typeof connectedForm !== 'object') {
    return {};
  }

  return {
    documentId: connectedForm.documentId,
    id: connectedForm.id,
  };
}

async function findConnectedForm(formRelation) {
  const { documentId, id } = getConnectedFormReference(formRelation);

  if (documentId) {
    return strapi.documents('plugin::api-forms.form').findOne({
      documentId,
      populate: ['notifications'],
    });
  }

  if (id) {
    return strapi.db.query('plugin::api-forms.form').findOne({
      where: { id },
      populate: ['notifications'],
    });
  }

  return null;
}

export default {
  /**
   * Before creating a submission, validate and remove spam attempts.
   */
  async beforeCreate(event) {
    try {
      const { params } = event;

      if (!params?.data?.submission) {
        throw new ForbiddenError('No submission provided');
      }

      const submission = normalizeSubmissionData(params.data.submission);

      // ✅ Honeypot Spam Protection
      const honeypotField = Object.keys(submission).find((key) => key.includes('honeypot'));

      if (honeypotField && submission[honeypotField] !== '') {
        throw new ForbiddenError('Spam detected (honeypot filled)');
      }

      // Remove honeypot field
      if (honeypotField) {
        delete submission[honeypotField];
      }

      // ✅ Update submission data
      params.data.submission = submission;
    } catch (error) {
      strapi.log.error('beforeCreate error:', error);
      throw new ForbiddenError('Failed to process submission.');
    }
  },

  /**
   * After creating a submission, process notifications.
   */
  async afterCreate(event) {
    try {
      const { result, params } = event;

      if (!result || !params.data.form) {
        throw new ForbiddenError('No submission found');
      }

      const form = await findConnectedForm(params.data.form);

      if (!form?.notifications?.length) {
        return;
      }

      // // ✅ Filter enabled notifications
      const enabledNotifications = form.notifications.filter((handler) => handler.enabled);

      if (enabledNotifications.length === 0) {
        return;
      }

      // ✅ Process notifications sequentially (ensuring await works correctly)
      for (const handler of enabledNotifications) {
        if (!handler.service) {
          continue;
        }

        try {
          const response = await strapi
            .plugin('api-forms')
            .service('notification')
            .process(handler, result, form);

          strapi.log.info(`Notification sent successfully: ${JSON.stringify(response)}`);
        } catch (error) {
          strapi.log.error('Notification sending failed:', console.dir(error, { depth: null }));
        }
      }
    } catch (error) {
      strapi.log.error('afterCreate error:', error);
      console.dir(error, { depth: null });
      throw new ForbiddenError('Failed to process notifications.');
    }
  },
};
