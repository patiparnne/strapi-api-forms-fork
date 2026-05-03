import { PLUGIN_ID } from './pluginId';
import { Initializer } from './components/Initializer';
import { PluginIcon } from './components/PluginIcon';
import { getTranslation } from './utils/getTranslation';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: 'Forms',
      },
      Component: async () => {
        const { App } = await import('./pages/App');
        return App;
      },
    });

    // Register custom field for form field selector
    app.customFields.register({
      name: 'form-field-selector',
      pluginId: PLUGIN_ID,
      type: 'json',
      icon: PluginIcon,
      intlLabel: {
        id: getTranslation('form-field-selector.label'),
        defaultMessage: 'Form Field Selector',
      },
      intlDescription: {
        id: getTranslation('form-field-selector.description'),
        defaultMessage: 'Select a form and configure which fields to hide for this document',
      },
      components: {
        Input: async () => import('./components/FormFieldSelectorInput'),
      },
      options: {
        advanced: [
          {
            sectionTitle: {
              id: getTranslation('form-field-selector.options.advanced.settings'),
              defaultMessage: 'Settings',
            },
            items: [
              {
                name: 'options.description',
                type: 'textarea',
                intlLabel: {
                  id: getTranslation('form-field-selector.options.description.label'),
                  defaultMessage: 'Description',
                },
                description: {
                  id: getTranslation('form-field-selector.options.description.description'),
                  defaultMessage: 'A description for this field',
                },
              },
            ],
          },
        ],
      },
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: 'API Forms',
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return await Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);

          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};
