import { describe, it, expect } from 'vitest';
import { buildFollowUpList, flattenFollowUpList, FOLLOW_UP_CATEGORIES } from './follow-up.js';

// ─── テストヘルパー ───────────────────────────────────────────────────────────

const REFERENCE = new Date('2026-07-02T03:00:00Z'); // JST 2026-07-02 12:00

function makeCompany(overrides = {}) {
  return {
    companyId: 'C000001',
    companyName: 'テスト株式会社',
    status: '',
    sentDate: '',
    hasReply: '',
    meetingDate: '',
    closed: '',
    ...overrides,
  };
}

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('buildFollowUpList', () => {
  it('企業が0件の場合は全カテゴリが空配列になる', () => {
    const result = buildFollowUpList([], REFERENCE);
    expect(result.referenceDate).toBe('2026-07-02');
    for (const key of FOLLOW_UP_CATEGORIES) {
      expect(result[key]).toEqual([]);
    }
  });

  describe('商談予定', () => {
    it('商談日が今日の企業を meetingToday に分類する', () => {
      const company = makeCompany({ meetingDate: '2026-07-02' });
      const result = buildFollowUpList([company], REFERENCE);
      expect(result.meetingToday).toHaveLength(1);
      expect(result.meetingToday[0]).toMatchObject({
        companyId: 'C000001',
        category: 'meetingToday',
        actionType: 'MEETING',
        priority: 1,
        meetingDate: '2026-07-02',
      });
    });

    it('商談日が明日の企業を meetingTomorrow に分類する', () => {
      const company = makeCompany({ meetingDate: '2026-07-03' });
      const result = buildFollowUpList([company], REFERENCE);
      expect(result.meetingTomorrow).toHaveLength(1);
      expect(result.meetingTomorrow[0]).toMatchObject({
        category: 'meetingTomorrow',
        actionType: 'MEETING',
        priority: 3,
      });
    });

    it('商談日が今日/明日以外の企業はどちらにも分類しない', () => {
      const company = makeCompany({ meetingDate: '2026-07-10' });
      const result = buildFollowUpList([company], REFERENCE);
      expect(result.meetingToday).toEqual([]);
      expect(result.meetingTomorrow).toEqual([]);
    });

    it('複数社を会社名の五十音順で並べる', () => {
      const companies = [
        makeCompany({ companyId: 'C1', companyName: 'わ商事', meetingDate: '2026-07-02' }),
        makeCompany({ companyId: 'C2', companyName: 'あ商事', meetingDate: '2026-07-02' }),
      ];
      const result = buildFollowUpList(companies, REFERENCE);
      expect(result.meetingToday.map((c) => c.companyName)).toEqual(['あ商事', 'わ商事']);
    });
  });

  describe('返信待ち', () => {
    it('経過7日以上を waitingUrgent に分類する', () => {
      const company = makeCompany({ sentDate: '2026-06-25' }); // 7日経過
      const result = buildFollowUpList([company], REFERENCE);
      expect(result.waitingUrgent).toHaveLength(1);
      expect(result.waitingUrgent[0]).toMatchObject({
        category: 'waitingUrgent',
        actionType: 'FOLLOW_UP',
        priority: 2,
        sentDate: '2026-06-25',
        daysSinceSent: 7,
      });
      expect(result.waitingWarning).toEqual([]);
    });

    it('経過3〜6日を waitingWarning に分類する', () => {
      const company = makeCompany({ sentDate: '2026-06-29' }); // 3日経過
      const result = buildFollowUpList([company], REFERENCE);
      expect(result.waitingWarning).toHaveLength(1);
      expect(result.waitingWarning[0]).toMatchObject({
        category: 'waitingWarning',
        actionType: 'WAIT_REPLY',
        priority: 4,
        daysSinceSent: 3,
      });
      expect(result.waitingUrgent).toEqual([]);
    });

    it('経過3日未満は表示しない', () => {
      const company = makeCompany({ sentDate: '2026-06-30' }); // 2日経過
      const result = buildFollowUpList([company], REFERENCE);
      expect(result.waitingUrgent).toEqual([]);
      expect(result.waitingWarning).toEqual([]);
    });

    it('境界値: ちょうど7日は waitingUrgent、ちょうど6日は waitingWarning', () => {
      const urgent = makeCompany({ companyId: 'C1', sentDate: '2026-06-25' }); // 7日
      const warning = makeCompany({ companyId: 'C2', sentDate: '2026-06-26' }); // 6日
      const result = buildFollowUpList([urgent, warning], REFERENCE);
      expect(result.waitingUrgent.map((c) => c.companyId)).toEqual(['C1']);
      expect(result.waitingWarning.map((c) => c.companyId)).toEqual(['C2']);
    });

    it('sentDate が空の企業は返信待ちに含めない', () => {
      const company = makeCompany({ sentDate: '' });
      const result = buildFollowUpList([company], REFERENCE);
      expect(result.waitingUrgent).toEqual([]);
      expect(result.waitingWarning).toEqual([]);
    });

    it('status が「返信あり」の企業は返信待ちに含めない', () => {
      const company = makeCompany({ sentDate: '2026-06-20', status: '返信あり' });
      const result = buildFollowUpList([company], REFERENCE);
      expect(result.waitingUrgent).toEqual([]);
      expect(result.waitingWarning).toEqual([]);
    });

    it('status が「配信停止」の企業は返信待ちに含めない', () => {
      const company = makeCompany({ sentDate: '2026-06-20', status: '配信停止' });
      const result = buildFollowUpList([company], REFERENCE);
      expect(result.waitingUrgent).toEqual([]);
      expect(result.waitingWarning).toEqual([]);
    });

    it('商談日が設定済みの企業は返信待ちから除外する（二重表示防止）', () => {
      const company = makeCompany({ sentDate: '2026-06-01', meetingDate: '2026-08-01' });
      const result = buildFollowUpList([company], REFERENCE);
      expect(result.waitingUrgent).toEqual([]);
      expect(result.waitingWarning).toEqual([]);
      expect(result.meetingToday).toEqual([]);
      expect(result.meetingTomorrow).toEqual([]);
    });

    it('成約/失注が確定済みの企業は返信待ちから除外する', () => {
      const won = makeCompany({ companyId: 'C1', sentDate: '2026-06-01', closed: '成約' });
      const lost = makeCompany({ companyId: 'C2', sentDate: '2026-06-01', closed: '失注' });
      const result = buildFollowUpList([won, lost], REFERENCE);
      expect(result.waitingUrgent).toEqual([]);
      expect(result.waitingWarning).toEqual([]);
    });

    it('経過日数が長い順に並べる', () => {
      const companies = [
        makeCompany({ companyId: 'C1', sentDate: '2026-06-25' }), // 7日
        makeCompany({ companyId: 'C2', sentDate: '2026-06-10' }), // 22日
      ];
      const result = buildFollowUpList(companies, REFERENCE);
      expect(result.waitingUrgent.map((c) => c.companyId)).toEqual(['C2', 'C1']);
    });
  });

  it('成約/失注が確定済みの企業は商談日が今日でも除外する', () => {
    const company = makeCompany({ meetingDate: '2026-07-02', closed: '成約' });
    const result = buildFollowUpList([company], REFERENCE);
    expect(result.meetingToday).toEqual([]);
  });
});

describe('flattenFollowUpList', () => {
  it('優先順位順（meetingToday → waitingUrgent → meetingTomorrow → waitingWarning）にフラット化する', () => {
    const companies = [
      makeCompany({ companyId: 'C1', sentDate: '2026-06-29' }), // waitingWarning
      makeCompany({ companyId: 'C2', meetingDate: '2026-07-03' }), // meetingTomorrow
      makeCompany({ companyId: 'C3', sentDate: '2026-06-20' }), // waitingUrgent
      makeCompany({ companyId: 'C4', meetingDate: '2026-07-02' }), // meetingToday
    ];
    const result = buildFollowUpList(companies, REFERENCE);
    const flat = flattenFollowUpList(result);
    expect(flat.map((c) => c.companyId)).toEqual(['C4', 'C3', 'C2', 'C1']);
  });
});
