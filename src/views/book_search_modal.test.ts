import { factoryServiceProvider } from '@apis/base_api';
import { ServiceProvider } from '@src/constants';
import { BookSearchModal } from './book_search_modal';

jest.mock('@settings/settings', () => ({
  DEFAULT_SETTINGS: { localePreference: 'default' },
}));

jest.mock('@apis/base_api', () => ({
  factoryServiceProvider: jest.fn(),
}));

const mockFactory = factoryServiceProvider as jest.MockedFunction<typeof factoryServiceProvider>;

describe('BookSearchModal', () => {
  const mockGetByQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetByQuery.mockResolvedValue([
      {
        title: 'Test Book',
        subtitle: '',
        author: '',
        authors: [],
        category: '',
        categories: [],
        publisher: '',
        publishDate: '',
        totalPage: '',
        coverUrl: '',
        coverSmallUrl: '',
        description: '',
        link: '',
        previewLink: '',
      },
    ]);
    mockFactory.mockReturnValue({ getByQuery: mockGetByQuery });
  });

  it('hydrates secrets and rebuilds provider before getByQuery', async () => {
    const settings = {
      serviceProvider: ServiceProvider.google,
      localePreference: 'default',
      askForLocale: false,
      enableCoverImageEdgeCurl: true,
      apiKey: '',
    };

    const plugin = {
      app: document.createElement('div') as unknown as import('obsidian').App,
      manifest: { version: '0.8.1' },
      settings,
      hydrateSecrets: jest.fn(async () => {
        settings.apiKey = 'hydrated-key';
      }),
    };

    const modal = new BookSearchModal(plugin as never, 'flow', jest.fn());
    modal.contentEl = document.createElement('div');
    modal.close = jest.fn();
    await modal.searchBook();

    expect(plugin.hydrateSecrets).toHaveBeenCalled();
    expect(mockFactory).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: 'hydrated-key' }), '0.8.1');
    expect(mockGetByQuery).toHaveBeenCalledWith(
      'flow',
      expect.any(Object),
      expect.objectContaining({ onLegStart: expect.any(Function) }),
    );
  });
});
