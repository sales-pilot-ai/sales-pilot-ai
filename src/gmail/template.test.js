import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { renderTemplate, renderTemplateFile, loadTemplate } from './template.js';

// ─── renderTemplate ───────────────────────────────────────────────────────────

describe('renderTemplate', () => {
  it('{{key}} を vars の値で置換する', () => {
    const result = renderTemplate('こんにちは {{companyName}} 様', {
      companyName: '株式会社テスト',
    });
    expect(result).toBe('こんにちは 株式会社テスト 様');
  });

  it('複数のプレースホルダーをすべて置換する', () => {
    const result = renderTemplate('{{greeting}} {{name}}！', {
      greeting: 'おはようございます',
      name: '田中',
    });
    expect(result).toBe('おはようございます 田中！');
  });

  it('同じキーが複数あればすべて置換する', () => {
    const result = renderTemplate('{{name}}、{{name}}、{{name}}！', { name: 'A' });
    expect(result).toBe('A、A、A！');
  });

  it('vars にないキーは空文字に置換する', () => {
    const result = renderTemplate('{{missing}}は空になる', {});
    expect(result).toBe('は空になる');
  });

  it('null の値は空文字に置換する', () => {
    const result = renderTemplate('値: {{val}}', { val: null });
    expect(result).toBe('値: ');
  });

  it('undefined の値は空文字に置換する', () => {
    const result = renderTemplate('値: {{val}}', { val: undefined });
    expect(result).toBe('値: ');
  });

  it('数値は文字列に変換して置換する', () => {
    const result = renderTemplate('件数: {{count}} 件', { count: 42 });
    expect(result).toBe('件数: 42 件');
  });

  it('プレースホルダーがなければテンプレートをそのまま返す', () => {
    const tpl = 'プレースホルダーなし';
    expect(renderTemplate(tpl, { key: 'val' })).toBe(tpl);
  });

  it('vars が空オブジェクトのとき {{key}} はすべて空文字になる', () => {
    expect(renderTemplate('{{a}} {{b}}', {})).toBe(' ');
  });

  it('変数なしで呼んでも例外を投げない', () => {
    expect(() => renderTemplate('テンプレート')).not.toThrow();
  });
});

// ─── loadTemplate ─────────────────────────────────────────────────────────────

describe('loadTemplate', () => {
  it('存在するテンプレートを文字列で返す', () => {
    const txtPath = resolve('templates/emails/initial_contact.txt');
    const result = loadTemplate(txtPath);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('存在しないパスでは Error をスローする', () => {
    expect(() => loadTemplate('/nonexistent/path/template.txt')).toThrow(
      'テンプレートファイルが見つかりません'
    );
  });
});

// ─── renderTemplateFile ───────────────────────────────────────────────────────

describe('renderTemplateFile', () => {
  const VARS = {
    companyName: '株式会社サンプル',
    contactName: '山田太郎',
    meetingUrl: 'https://example.com/meeting',
  };

  it('テキストテンプレートを読み込んで変数を置換する', () => {
    const txtPath = resolve('templates/emails/initial_contact.txt');
    const result = renderTemplateFile(txtPath, VARS);
    expect(result).toContain('株式会社サンプル');
    expect(result).toContain('山田太郎');
    expect(result).toContain('https://example.com/meeting');
    expect(result).not.toContain('{{companyName}}');
    expect(result).not.toContain('{{contactName}}');
    expect(result).not.toContain('{{meetingUrl}}');
  });

  it('HTML テンプレートを読み込んで変数を置換する', () => {
    const htmlPath = resolve('templates/emails/initial_contact.html');
    const result = renderTemplateFile(htmlPath, VARS);
    expect(result).toContain('株式会社サンプル');
    expect(result).not.toContain('{{companyName}}');
    expect(result).not.toContain('{{meetingUrl}}');
  });

  it('件名テンプレートを読み込んで変数を置換する', () => {
    const subjectPath = resolve('templates/emails/initial_contact.subject.txt');
    const result = renderTemplateFile(subjectPath, VARS).trim();
    expect(result).toContain('株式会社サンプル');
    expect(result).not.toContain('{{companyName}}');
  });
});
