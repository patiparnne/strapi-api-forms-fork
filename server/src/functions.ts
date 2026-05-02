import { SubmissionType } from '../../admin/src/utils/types';
import { camelCase } from 'lodash';

function normalizeTemplateKey(key: string): string {
  return camelCase(key.replace(/\s+/g, ''));
}

function stringifyTemplateValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (Array.isArray(value)) {
    return value.map(stringifyTemplateValue).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function normalizeSubmissionData(submission: any): Record<string, any> {
  if (typeof submission === 'string') {
    try {
      const parsed = JSON.parse(submission);
      return normalizeSubmissionData(parsed);
    } catch (error) {
      return {};
    }
  }

  if (!submission || typeof submission !== 'object' || Array.isArray(submission)) {
    return {};
  }

  return submission;
}

function createSubmissionLookup(submission: any): Record<string, any> {
  const normalizedSubmission = normalizeSubmissionData(submission);

  return Object.keys(normalizedSubmission).reduce(
    (lookup, key) => {
      lookup[key] = normalizedSubmission[key];
      lookup[normalizeTemplateKey(key)] = normalizedSubmission[key];
      return lookup;
    },
    {} as Record<string, any>
  );
}

/**
 * Validate email format
 */
function validateEmail(emails: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emails.split(',').every((email) => emailPattern.test(email.trim()));
}

/**
 * Retrieve value from submission fields
 */
function getValueFromSubmissionByKey(key: string, submission: any): string {
  const lookup = createSubmissionLookup(submission);

  return stringifyTemplateValue(lookup[key] ?? lookup[normalizeTemplateKey(key)]);
}

/**
 * Replace placeholders in the email template
 */
function replaceDynamicVariables(message: string, submission: any): string {
  const normalizedSubmission = normalizeSubmissionData(submission);
  const lookup = createSubmissionLookup(normalizedSubmission);

  return message.replace(/{{\s*([^{}]+?)\s*}}/g, (placeholder, key) => {
    if (key === 'submission') {
      return JSON.stringify(normalizedSubmission);
    }

    const value = lookup[key] ?? lookup[normalizeTemplateKey(key)];

    return value === undefined ? placeholder : stringifyTemplateValue(value);
  });
}

/**
 * Process file attachments for email
 */
async function getFiles(submission: SubmissionType, provider: string): Promise<any[]> {
  return Promise.all(
    submission.files.map(async (file) => {
      const isAbsoluteUrl = /^(https?:\/\/)/.test(file.url);
      const fileUrl = isAbsoluteUrl ? file.url : `${strapi.config.get('server.url')}${file.url}`;

      if (provider === 'mailgun') {
        try {
          const response = await fetch(fileUrl);
          const buffer = await response.arrayBuffer();
          return {
            filename: file.name,
            content: Buffer.from(buffer).toString('base64'),
          };
        } catch (error) {
          strapi.log.error(`Failed to fetch file: ${fileUrl}`, error);
          return null;
        }
      } else {
        return { filename: file.name, path: fileUrl };
      }
    })
  ).then((files) => files.filter(Boolean)); // Remove failed file fetches
}

export {
  validateEmail,
  getValueFromSubmissionByKey,
  replaceDynamicVariables,
  getFiles,
  normalizeSubmissionData,
};
