import type { Core } from '@strapi/strapi';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // Register custom field for form field selector
  strapi.customFields.register({
    name: 'form-field-selector',
    plugin: 'api-forms',
    type: 'json',
  });
};

export default register;
