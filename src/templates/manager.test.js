import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── モック ───────────────────────────────────────────────────────────────────

const { mockReadFileSync, mockWriteFileSync, mockExistsSync, mockUnlinkSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
}));

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  unlinkSync: mockUnlinkSync,
}));

// ─── テスト対象 ───────────────────────────────────────────────────────────────

const {
  listTemplates,
  templateExists,
  getTemplate,
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  deleteTemplate,
  TEMPLATES_DIR,
} = await import('./manager.js');

// ─── テストヘルパー ───────────────────────────────────────────────────────────

const INDEX_PATH = `${TEMPLATES_DIR}/templates.json`;

const SAMPLE_INDEX = {
  initial_contact: {
    displayName: '初回営業',
    description: '新規開拓の初回コンタクトメール',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
};

/**
 * existsSync/readFileSync/writeFileSync/unlinkSync の挙動を可変のファイル状態から組み立てる。
 * writeFileSync/unlinkSync も状態を更新するため、書き込み直後の読み取りを含むテストが書ける。
 * @param {Record<string, string>} initialFiles  パス → 内容
 */
function mockFileSystem(initialFiles) {
  const files = { ...initialFiles };
  mockExistsSync.mockImplementation((path) => path in files);
  mockReadFileSync.mockImplementation((path) => {
    if (!(path in files)) throw new Error(`ENOENT: ${path}`);
    return files[path];
  });
  mockWriteFileSync.mockImplementation((path, content) => {
    files[path] = content;
  });
  mockUnlinkSync.mockImplementation((path) => {
    delete files[path];
  });
  return files;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('readIndex（内部動作の観測）', () => {
  it('templates.json が存在しない・initial_contact.txt も存在しない場合は空インデックスを書き込む', () => {
    mockFileSystem({});
    listTemplates();
    expect(mockWriteFileSync).toHaveBeenCalledWith(INDEX_PATH, JSON.stringify({}, null, 2) + '\n', 'utf-8');
  });

  it('templates.json が無く initial_contact.txt がある場合は「初回営業」として自動登録する', () => {
    mockFileSystem({
      [`${TEMPLATES_DIR}/initial_contact.txt`]: '本文',
    });
    const result = listTemplates();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'initial_contact', displayName: '初回営業' });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      INDEX_PATH,
      expect.stringContaining('初回営業'),
      'utf-8'
    );
  });
});

describe('listTemplates', () => {
  it('名前の昇順でメタデータ一覧を返す', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify({
        second_follow_up: { displayName: '2回目フォロー', description: '', createdAt: '', updatedAt: '' },
        initial_contact: SAMPLE_INDEX.initial_contact,
      }),
    });
    const result = listTemplates();
    expect(result.map((t) => t.name)).toEqual(['initial_contact', 'second_follow_up']);
  });

  it('HTML本文が存在するかを hasHtml で示す', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX),
      [`${TEMPLATES_DIR}/initial_contact.html`]: '<html></html>',
    });
    const result = listTemplates();
    expect(result[0].hasHtml).toBe(true);
  });
});

describe('templateExists', () => {
  it('存在するテンプレートは true', () => {
    mockFileSystem({ [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX) });
    expect(templateExists('initial_contact')).toBe(true);
  });

  it('存在しないテンプレートは false', () => {
    mockFileSystem({ [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX) });
    expect(templateExists('unknown')).toBe(false);
  });
});

describe('getTemplate', () => {
  it('件名・本文・HTMLを含めて返す', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX),
      [`${TEMPLATES_DIR}/initial_contact.subject.txt`]: '件名です\n',
      [`${TEMPLATES_DIR}/initial_contact.txt`]: 'テキスト本文',
      [`${TEMPLATES_DIR}/initial_contact.html`]: '<p>HTML本文</p>',
    });
    const result = getTemplate('initial_contact');
    expect(result).toMatchObject({
      name: 'initial_contact',
      displayName: '初回営業',
      subject: '件名です',
      textBody: 'テキスト本文',
      htmlBody: '<p>HTML本文</p>',
    });
  });

  it('HTMLが無い場合は htmlBody が null', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX),
      [`${TEMPLATES_DIR}/initial_contact.subject.txt`]: '件名',
      [`${TEMPLATES_DIR}/initial_contact.txt`]: '本文',
    });
    const result = getTemplate('initial_contact');
    expect(result.htmlBody).toBeNull();
  });

  it('存在しないテンプレートは例外を投げる', () => {
    mockFileSystem({ [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX) });
    expect(() => getTemplate('unknown')).toThrow('テンプレートが見つかりません: unknown');
  });
});

describe('createTemplate', () => {
  it('本文・件名ファイルとインデックスエントリを書き込む', () => {
    mockFileSystem({ [INDEX_PATH]: JSON.stringify({}) });
    createTemplate({
      name: 'second_follow_up',
      displayName: '2回目フォロー',
      subject: '件名',
      textBody: '本文',
    });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      `${TEMPLATES_DIR}/second_follow_up.txt`,
      '本文',
      'utf-8'
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      `${TEMPLATES_DIR}/second_follow_up.subject.txt`,
      '件名',
      'utf-8'
    );
    const indexWriteCall = mockWriteFileSync.mock.calls.find(([path]) => path === INDEX_PATH);
    expect(JSON.parse(indexWriteCall[1]).second_follow_up).toMatchObject({
      displayName: '2回目フォロー',
    });
  });

  it('htmlBody を指定した場合は .html も書き込む', () => {
    mockFileSystem({ [INDEX_PATH]: JSON.stringify({}) });
    createTemplate({
      name: 'second_follow_up',
      displayName: '2回目フォロー',
      subject: '件名',
      textBody: '本文',
      htmlBody: '<p>本文</p>',
    });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      `${TEMPLATES_DIR}/second_follow_up.html`,
      '<p>本文</p>',
      'utf-8'
    );
  });

  it('不正な名前形式は例外を投げる', () => {
    mockFileSystem({ [INDEX_PATH]: JSON.stringify({}) });
    expect(() =>
      createTemplate({ name: 'Second Follow Up', displayName: 'x', subject: 's', textBody: 't' })
    ).toThrow('英小文字・数字・アンダースコア');
  });

  it('既存の名前と重複する場合は例外を投げる', () => {
    mockFileSystem({ [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX) });
    expect(() =>
      createTemplate({ name: 'initial_contact', displayName: 'x', subject: 's', textBody: 't' })
    ).toThrow('既に存在します');
  });
});

describe('updateTemplate', () => {
  it('指定したフィールドのみ更新する', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX),
      [`${TEMPLATES_DIR}/initial_contact.subject.txt`]: '旧件名',
      [`${TEMPLATES_DIR}/initial_contact.txt`]: '旧本文',
    });
    updateTemplate('initial_contact', { subject: '新件名' });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      `${TEMPLATES_DIR}/initial_contact.subject.txt`,
      '新件名',
      'utf-8'
    );
    expect(mockWriteFileSync).not.toHaveBeenCalledWith(
      `${TEMPLATES_DIR}/initial_contact.txt`,
      expect.anything(),
      'utf-8'
    );
  });

  it('htmlBody に null を渡すと既存の .html を削除する', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX),
      [`${TEMPLATES_DIR}/initial_contact.txt`]: '本文',
      [`${TEMPLATES_DIR}/initial_contact.subject.txt`]: '件名',
      [`${TEMPLATES_DIR}/initial_contact.html`]: '<p>既存</p>',
    });
    updateTemplate('initial_contact', { htmlBody: null });
    expect(mockUnlinkSync).toHaveBeenCalledWith(`${TEMPLATES_DIR}/initial_contact.html`);
  });

  it('updatedAt を更新する', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX),
      [`${TEMPLATES_DIR}/initial_contact.txt`]: '本文',
      [`${TEMPLATES_DIR}/initial_contact.subject.txt`]: '件名',
    });
    updateTemplate('initial_contact', { description: '新しい説明' });
    const indexWriteCall = mockWriteFileSync.mock.calls.find(([path]) => path === INDEX_PATH);
    const written = JSON.parse(indexWriteCall[1]).initial_contact;
    expect(written.description).toBe('新しい説明');
    expect(written.updatedAt).not.toBe(SAMPLE_INDEX.initial_contact.updatedAt);
  });

  it('存在しないテンプレートは例外を投げる', () => {
    mockFileSystem({ [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX) });
    expect(() => updateTemplate('unknown', { subject: 'x' })).toThrow('テンプレートが見つかりません');
  });
});

describe('duplicateTemplate', () => {
  it('本文・件名・HTMLをコピーして新規作成する', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX),
      [`${TEMPLATES_DIR}/initial_contact.subject.txt`]: '件名',
      [`${TEMPLATES_DIR}/initial_contact.txt`]: '本文',
      [`${TEMPLATES_DIR}/initial_contact.html`]: '<p>HTML</p>',
    });

    duplicateTemplate('initial_contact', 'second_follow_up', { displayName: '2回目フォロー' });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      `${TEMPLATES_DIR}/second_follow_up.txt`,
      '本文',
      'utf-8'
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      `${TEMPLATES_DIR}/second_follow_up.html`,
      '<p>HTML</p>',
      'utf-8'
    );
  });

  it('displayName を省略すると「(元の表示名)のコピー」になる', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX),
      [`${TEMPLATES_DIR}/initial_contact.subject.txt`]: '件名',
      [`${TEMPLATES_DIR}/initial_contact.txt`]: '本文',
    });

    duplicateTemplate('initial_contact', 'second_follow_up', {});

    const indexWriteCall = mockWriteFileSync.mock.calls.find(([path]) => path === INDEX_PATH);
    expect(JSON.parse(indexWriteCall[1]).second_follow_up.displayName).toBe('初回営業のコピー');
  });

  it('複製先の名前が既存と重複する場合は例外を投げる', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX),
      [`${TEMPLATES_DIR}/initial_contact.subject.txt`]: '件名',
      [`${TEMPLATES_DIR}/initial_contact.txt`]: '本文',
    });
    expect(() =>
      duplicateTemplate('initial_contact', 'initial_contact', {})
    ).toThrow('既に存在します');
  });

  it('複製元が存在しない場合は例外を投げる', () => {
    mockFileSystem({ [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX) });
    expect(() => duplicateTemplate('unknown', 'new_name', {})).toThrow('テンプレートが見つかりません');
  });
});

describe('deleteTemplate', () => {
  it('本体ファイルとインデックスエントリを削除する', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX),
      [`${TEMPLATES_DIR}/initial_contact.txt`]: '本文',
      [`${TEMPLATES_DIR}/initial_contact.subject.txt`]: '件名',
      [`${TEMPLATES_DIR}/initial_contact.html`]: '<p></p>',
    });

    deleteTemplate('initial_contact');

    expect(mockUnlinkSync).toHaveBeenCalledWith(`${TEMPLATES_DIR}/initial_contact.txt`);
    expect(mockUnlinkSync).toHaveBeenCalledWith(`${TEMPLATES_DIR}/initial_contact.subject.txt`);
    expect(mockUnlinkSync).toHaveBeenCalledWith(`${TEMPLATES_DIR}/initial_contact.html`);
    const indexWriteCall = mockWriteFileSync.mock.calls.find(([path]) => path === INDEX_PATH);
    expect(JSON.parse(indexWriteCall[1])).not.toHaveProperty('initial_contact');
  });

  it('HTMLファイルが無い場合は unlinkSync を呼ばない', () => {
    mockFileSystem({
      [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX),
      [`${TEMPLATES_DIR}/initial_contact.txt`]: '本文',
      [`${TEMPLATES_DIR}/initial_contact.subject.txt`]: '件名',
    });
    deleteTemplate('initial_contact');
    expect(mockUnlinkSync).not.toHaveBeenCalledWith(`${TEMPLATES_DIR}/initial_contact.html`);
  });

  it('存在しないテンプレートは例外を投げる', () => {
    mockFileSystem({ [INDEX_PATH]: JSON.stringify(SAMPLE_INDEX) });
    expect(() => deleteTemplate('unknown')).toThrow('テンプレートが見つかりません');
  });
});
