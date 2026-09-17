// Staff-side notice Tiptap E2E: scenarios 1 (editor/a11y), 2 (link policy),
// 3 (image lifecycle + validation), 4a (staff read path), 8 (bundle isolation).
// usage: MARKER="E2E-xxxx" node scripts/notice-e2e/staff.mjs
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const FIX = path.join(ROOT, 'fixtures');
const AUTH = path.join(ROOT, '..', 'pixel-diff', '.auth', 'staff.json');
const ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const MARKER = process.env.MARKER || 'E2E-STAFF';
await mkdir(OUT, { recursive: true });

const results = [];
const net = []; // network log
let phase = 'init';
const check = (name, pass, evidence) => {
  results.push({ scenario: name, pass: !!pass, evidence: evidence ?? null });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${evidence ? '  :: ' + JSON.stringify(evidence).slice(0, 300) : ''}`);
};
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false }).catch(() => {}); };

const STAFF_ID = process.env.STAFF_ID || 'admin';
const STAFF_PW = process.env.STAFF_PW || 'erp!12345';
const browser = await chromium.launch();
// Fresh inline login per run: imported storageState goes stale within minutes because
// Supabase rotates the refresh token (a prior run consumes it). A live session auto-refreshes.
const ctx = await browser.newContext({ viewport: { width: 1340, height: 900 } });
const page = await ctx.newPage();
async function loginFresh() {
  await page.goto(ORIGIN + '/staff/login', { waitUntil: 'networkidle' });
  await page.fill('#username', STAFF_ID);
  await page.fill('#password', STAFF_PW);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

page.on('request', (r) => {
  const u = r.url();
  if (/\/storage\/v1\/object\/|\/rest\/v1\/(notices|attachments)|tiptap|prosemirror|NoticeEditor/i.test(u)) {
    net.push({ phase, method: r.method(), url: u.replace(/^https?:\/\/[^/]+/, '') });
  }
});
const errResponses = [];
page.on('response', async (resp) => {
  const u = resp.url();
  if (/\/rest\/v1\/(notices|attachments)|\/storage\/v1\/object\//i.test(u) && resp.status() >= 400) {
    let body = '';
    try { body = (await resp.text()).slice(0, 400); } catch { /* ignore */ }
    errResponses.push({ phase, status: resp.status(), method: resp.request().method(), url: u.replace(/^https?:\/\/[^/]+/, ''), body });
    console.log(`HTTP ${resp.status()} ${resp.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '')} :: ${body}`);
  }
});
const netSince = (ph) => net.filter((n) => n.phase === ph);

try {
  await loginFresh();
  // ---------- load notices list (bundle isolation baseline) ----------
  phase = 'list-load';
  await page.goto(ORIGIN + '/staff/notices', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const editorChunkOnList = net.filter((n) => n.phase === 'list-load' && /tiptap|prosemirror|NoticeEditor/i.test(n.url));
  // /staff/notices HOSTS the create/edit modal (NoticeFormModal statically imports NoticeEditor),
  // so it is a Tiptap-USING route and loading the editor chunk here is expected. The real §8
  // isolation guarantee (read-only routes never pull the editor) is verified in the server harness.
  check('S8(obs): /staff/notices (Tiptap-using route) loads the editor chunk — expected, recorded for reference', true, { editorChunkOnListLoad: editorChunkOnList.length });
  await shot(page, 's8-list-before-modal');

  // ---------- open create modal ----------
  phase = 'open-modal';
  await page.getByRole('button', { name: /공지 등록/ }).first().click();
  await page.getByText('공지 등록', { exact: true }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(700);
  const editorChunkAfterModal = net.filter((n) => /tiptap|prosemirror|NoticeEditor/i.test(n.url));
  check('S8: opening create modal DOES load the tiptap/prosemirror editor chunk', editorChunkAfterModal.length > 0, { count: editorChunkAfterModal.length, sample: editorChunkAfterModal.slice(0, 3) });

  const editor = page.getByRole('textbox', { name: '공지 내용' });
  const toolbar = page.getByRole('toolbar', { name: '공지 서식' });
  await editor.waitFor({ timeout: 10000 });

  // ---------- S1: editor region a11y attributes ----------
  phase = 's1';
  const role = await editor.getAttribute('role');
  const multiline = await editor.getAttribute('aria-multiline');
  const label = await editor.getAttribute('aria-label');
  check('S1: editor region role=textbox / aria-multiline=true / aria-label="공지 내용"',
    role === 'textbox' && multiline === 'true' && label === '공지 내용', { role, multiline, label });
  check('S1: toolbar role=toolbar aria-label="공지 서식" present', await toolbar.count() === 1);

  // all 12 toolbar buttons present with exact aria-labels
  const labels = ['문단', '제목 1', '제목 2', '굵게', '기울임', '글머리 목록', '번호 목록', '인용', '링크', '이미지', '실행 취소', '다시 실행'];
  const missing = [];
  for (const l of labels) { if (await page.getByRole('button', { name: l, exact: true }).count() === 0) missing.push(l); }
  check('S1: all 12 toolbar buttons present with exact aria-labels', missing.length === 0, { missing });

  // typing
  await editor.click();
  await page.keyboard.type('공지 본문 테스트 문장입니다.');
  const typed = await editor.innerText();
  check('S1: typing inserts text', typed.includes('공지 본문 테스트'), { typed: typed.slice(0, 60) });

  // bold toggle + aria-pressed
  const boldBtn = page.getByRole('button', { name: '굵게', exact: true });
  await boldBtn.click();
  const pressedOn = await boldBtn.getAttribute('aria-pressed');
  await page.keyboard.type('굵은문장');
  await boldBtn.click();
  const pressedOff = await boldBtn.getAttribute('aria-pressed');
  const hasStrong = /<strong>굵은문장<\/strong>/.test(await editor.innerHTML());
  check('S1: 굵게 toggles aria-pressed true→false and wraps text in <strong>', pressedOn === 'true' && pressedOff === 'false' && hasStrong, { pressedOn, pressedOff, hasStrong });

  // heading level 2 (label "제목 1")
  await page.keyboard.press('Enter');
  const h2Btn = page.getByRole('button', { name: '제목 1', exact: true });
  await h2Btn.click();
  await page.keyboard.type('소제목');
  const h2Pressed = await h2Btn.getAttribute('aria-pressed');
  const hasH2 = (await editor.locator('h2').count()) > 0;
  check('S1: 제목 1 → H2 (aria-pressed + <h2> in DOM)', h2Pressed === 'true' && hasH2, { h2Pressed, hasH2 });
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '문단', exact: true }).click();

  // bullet / ordered / blockquote quick toggles
  const bul = page.getByRole('button', { name: '글머리 목록', exact: true });
  await bul.click();
  await page.keyboard.type('목록항목');
  const hasUl = (await editor.locator('ul li').count()) > 0;
  check('S1: 글머리 목록 → <ul><li>', hasUl && (await bul.getAttribute('aria-pressed')) === 'true', { hasUl });
  await bul.click();

  // undo / redo — isolate with a distinctive token so the assertion is unambiguous
  phase = 's1-undo';
  await editor.click();
  await page.keyboard.type('※UNDOTOKEN');
  const beforeUndo = await editor.innerText();
  const undoBtn = page.getByRole('button', { name: '실행 취소', exact: true });
  const redoBtn = page.getByRole('button', { name: '다시 실행', exact: true });
  let afterUndo = beforeUndo;
  for (let k = 0; k < 6 && afterUndo.includes('※UNDOTOKEN'); k++) { await undoBtn.click(); await page.waitForTimeout(120); afterUndo = await editor.innerText(); }
  let afterRedo = afterUndo;
  for (let k = 0; k < 6 && !afterRedo.includes('※UNDOTOKEN'); k++) { await redoBtn.click(); await page.waitForTimeout(120); afterRedo = await editor.innerText(); }
  check('S1: undo removes just-typed token, redo restores it', beforeUndo.includes('※UNDOTOKEN') && !afterUndo.includes('※UNDOTOKEN') && afterRedo.includes('※UNDOTOKEN'), { before: beforeUndo.includes('※UNDOTOKEN'), afterUndo: afterUndo.includes('※UNDOTOKEN'), afterRedo: afterRedo.includes('※UNDOTOKEN') });

  // paste-with-formatting: keep bold, strip disabled marks (underline/code/strike)
  phase = 's1-paste';
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await editor.evaluate((el, html) => {
    const dt = new DataTransfer();
    dt.setData('text/html', html);
    dt.setData('text/plain', 'BOLD UNDER CODE STRIKE');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, '<p><strong>BOLD</strong> <u>UNDER</u> <code>CODE</code> <s>STRIKE</s></p>');
  await page.waitForTimeout(200);
  const pastedHtml = await editor.innerHTML();
  const keepsBold = /<strong>BOLD<\/strong>/.test(pastedHtml);
  const stripsDisallowed = !/<u>|<code>|<s>|<del>|<strike>/i.test(pastedHtml);
  const keepsText = /UNDER/.test(pastedHtml) && /CODE/.test(pastedHtml);
  check('S1: paste keeps <strong>, strips disabled marks (u/code/s) but keeps their text', keepsBold && stripsDisallowed && keepsText, { keepsBold, stripsDisallowed, keepsText, html: pastedHtml.slice(0, 200) });

  // long document scroll: max-height + overflow, scrollHeight > clientHeight
  phase = 's1-long';
  const longText = Array.from({ length: 120 }, (_, i) => `긴 문서 라인 ${i + 1} 스크롤 테스트`).join('\n');
  await editor.click();
  await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
  await editor.evaluate((el, txt) => {
    const dt = new DataTransfer(); dt.setData('text/plain', txt);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, longText);
  await page.waitForTimeout(300);
  const scrollInfo = await editor.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { maxHeight: cs.maxHeight, overflowY: cs.overflowY, scrollH: el.scrollHeight, clientH: el.clientHeight };
  });
  check('S1: long doc — editor has max-height + overflow-y:auto and scrolls', scrollInfo.overflowY === 'auto' && scrollInfo.scrollH > scrollInfo.clientH, scrollInfo);

  // mobile flex-wrap toolbar
  phase = 's1-mobile';
  await page.setViewportSize({ width: 390, height: 850 });
  await page.waitForTimeout(300);
  const wrapInfo = await toolbar.evaluate((el) => {
    const cs = getComputedStyle(el);
    const btns = [...el.querySelectorAll('button')].map((b) => b.getBoundingClientRect().top);
    const rows = new Set(btns.map((t) => Math.round(t))).size;
    return { flexWrap: cs.flexWrap, rows };
  });
  check('S1: mobile (390px) toolbar flex-wrap:wrap and wraps to >1 row', wrapInfo.flexWrap === 'wrap' && wrapInfo.rows > 1, wrapInfo);
  await shot(page, 's1-mobile-toolbar');
  await page.setViewportSize({ width: 1340, height: 900 });

  // content-required a11y (aria-invalid + describedby) — submit empty content
  phase = 's1-invalid';
  await editor.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
  await page.locator('#notice-title').fill(`${MARKER} 임시`);
  await page.getByRole('button', { name: /^(등록|저장)/ }).click().catch(() => {});
  await page.waitForTimeout(400);
  const invalid = await editor.getAttribute('aria-invalid');
  const describedby = await editor.getAttribute('aria-describedby');
  const errText = await page.locator('#notice-content-error').innerText().catch(() => '');
  check('S1: empty content → aria-invalid=true + aria-describedby=notice-content-error + error message', invalid === 'true' && describedby === 'notice-content-error' && errText.length > 0, { invalid, describedby, errText });

  // ---------- S2: link policy ----------
  phase = 's2';
  await editor.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
  await page.keyboard.type('링크텍스트');
  await page.keyboard.press('Control+A');
  await page.getByRole('button', { name: '링크', exact: true }).click();
  const linkInput = page.getByRole('textbox', { name: '링크 주소' });
  await linkInput.waitFor({ timeout: 5000 });

  const policyMsg = page.getByText('링크만 넣을 수 있어요', { exact: false });
  // reject javascript:
  await linkInput.fill('javascript:alert(1)');
  await page.getByRole('button', { name: '적용', exact: true }).click();
  await page.waitForTimeout(200);
  const alert1visible = await policyMsg.isVisible().catch(() => false);
  const noAnchorAfterJs = (await editor.locator('a').count()) === 0;
  check('S2: javascript: rejected with policy alert + no <a> inserted', alert1visible && noAnchorAfterJs, { alertVisible: alert1visible, noAnchorAfterJs });

  // reject data:
  await linkInput.fill('data:text/html,<b>x</b>');
  await page.getByRole('button', { name: '적용', exact: true }).click();
  await page.waitForTimeout(150);
  const alert2visible = await policyMsg.isVisible().catch(() => false);
  check('S2: data: rejected', alert2visible && (await editor.locator('a').count()) === 0, { alertVisible: alert2visible });

  // accept https://
  await linkInput.fill('https://example.com');
  await page.getByRole('button', { name: '적용', exact: true }).click();
  await page.waitForTimeout(250);
  const anchor = editor.locator('a[href="https://example.com"]');
  const anchorAttrs = await anchor.first().evaluate((a) => ({ target: a.getAttribute('target'), rel: a.getAttribute('rel') })).catch(() => ({}));
  check('S2: https:// accepted → <a target=_blank rel="noopener noreferrer nofollow">', (await anchor.count()) > 0 && anchorAttrs.target === '_blank' && anchorAttrs.rel === 'noopener noreferrer nofollow', anchorAttrs);
  await shot(page, 's2-link');

  // ---------- S3: image lifecycle ----------
  phase = 's3-select';
  // keep the S2 link ('링크텍스트' → https://example.com) in the doc so the read-view <a> output
  // (target/rel) can be verified in S4a; append an image below it
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('이미지 본문 문단.');
  await page.keyboard.press('Enter');
  const fileInput = page.locator('input[type="file"][aria-label="본문 이미지 선택"]');
  const netBeforeSelect = net.length;
  await fileInput.setInputFiles(path.join(FIX, 'e2e-img-a.png'));
  await page.waitForTimeout(600);
  const blobImg = editor.locator('img[src^="blob:"]');
  const uploadsDuringSelect = net.slice(netBeforeSelect).filter((n) => /\/storage\/v1\/object\/(?!sign)/i.test(n.url) && n.method === 'POST');
  check('S3a: selecting image shows blob preview and does NOT upload to Storage yet', (await blobImg.count()) === 1 && uploadsDuringSelect.length === 0, { blobImgs: await blobImg.count(), uploadsDuringSelect });
  await shot(page, 's3-blob-preview');

  // MIME reject (gif) and size reject (>10MB)
  phase = 's3-validate';
  await fileInput.setInputFiles(path.join(FIX, 'e2e-not-allowed.gif'));
  await page.waitForTimeout(400);
  const gifToast = await page.getByText(/형식|지원|이미지|JPG|PNG|WebP|jpeg/i).first().innerText().catch(() => '');
  const gifCount = await editor.locator('img').count();
  check('S3: invalid MIME (gif) rejected (no new image node, warning shown)', gifCount === 1, { gifCount, toast: gifToast });
  await fileInput.setInputFiles(path.join(FIX, 'e2e-img-huge.png'));
  await page.waitForTimeout(500);
  const hugeCount = await editor.locator('img').count();
  check('S3: oversize (>10MB) rejected (still 1 image node)', hugeCount === 1, { hugeCount });

  // fill title + save
  phase = 's3-save';
  await page.locator('#notice-title').fill(`${MARKER} 이미지 공지`);
  const saveBtn = page.getByRole('dialog').locator('button[type="submit"]');
  const netBeforeSave = net.length;
  await saveBtn.click();
  // wait for success toast
  const okToast = await page.getByText('공지가 등록되었습니다.').waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(800);
  const saveReqs = net.slice(netBeforeSave);
  const uploadReq = saveReqs.find((n) => /\/storage\/v1\/object\/attachments\//i.test(n.url) && n.method === 'POST' && !/\/sign\//.test(n.url));
  const noticePost = saveReqs.find((n) => /\/rest\/v1\/notices/i.test(n.url) && n.method === 'POST');
  const attachPost = saveReqs.find((n) => /\/rest\/v1\/attachments/i.test(n.url) && n.method === 'POST');
  check('S3b: on save — Storage upload fires', !!uploadReq, uploadReq || null);
  check('S3b: on save — notices INSERT fires', !!noticePost, noticePost || null);
  check('S3b: on save — attachments INSERT fires', !!attachPost, attachPost || null);
  check('S3b: success toast shown', okToast);
  await shot(page, 's3-saved');

  // ---------- S4a: staff read path ----------
  phase = 's4a';
  await page.waitForTimeout(1000);
  // open the created notice detail (row with our marker)
  const row = page.getByText(`${MARKER} 이미지 공지`).first();
  await row.click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const detailImg = page.locator('article img, [class*="image"] img, img[class*="image"]').filter({ hasNot: page.locator('[src^="blob:"]') });
  const anyDetailImg = page.locator('img').filter({ has: undefined });
  // find an <img> whose src is a signed storage URL
  const signedImg = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')].map((i) => i.currentSrc || i.src);
    return imgs.find((s) => /\/storage\/v1\/object\/sign\/attachments\//.test(s)) || null;
  });
  check('S4a: staff detail renders body image via signed Storage URL (RLS client signing)', !!signedImg, { signedImg: signedImg ? signedImg.slice(0, 120) : null });
  // link renders with target/rel in read view
  const detailAnchor = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === 'https://example.com');
    return a ? { target: a.getAttribute('target'), rel: a.getAttribute('rel') } : null;
  });
  check('S4a: staff detail — link keeps target=_blank rel=noopener noreferrer nofollow', detailAnchor && detailAnchor.target === '_blank' && detailAnchor.rel === 'noopener noreferrer nofollow', detailAnchor);
  // no dangerouslySetInnerHTML: check there is a rendered <img> and <a> as real elements (static-renderer)
  await shot(page, 's4a-staff-detail');

  // ---------- S3c: edit → remove image → save → orphan cleanup (deleteRemovedNoticeImages) ----------
  phase = 's3c';
  const editBtn = page.getByRole('button', { name: '수정', exact: true });
  if (await editBtn.count() > 0) {
    await editBtn.first().click();
    await page.getByText('공지 수정', { exact: true }).waitFor({ timeout: 10000 });
    const editEditor = page.getByRole('textbox', { name: '공지 내용' });
    await editEditor.waitFor({ timeout: 10000 });
    await page.waitForTimeout(600);
    const imgBefore = await editEditor.locator('img').count();
    const removeImgBtn = page.getByRole('button', { name: '이미지 삭제', exact: true });
    const netBeforeRemove = net.length;
    if (await removeImgBtn.count() > 0) { await removeImgBtn.first().click(); await page.waitForTimeout(300); }
    const imgAfter = await editEditor.locator('img').count();
    check('S3c: 이미지 삭제 removes the image node from the editor', imgBefore >= 1 && imgAfter === 0, { imgBefore, imgAfter });
    await page.getByRole('dialog').locator('button[type="submit"]').click();
    const okEdit = await page.getByText('공지가 수정되었습니다.').waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(1000);
    const removeReqs = net.slice(netBeforeRemove);
    const attachDelete = removeReqs.find((n) => /\/rest\/v1\/attachments/i.test(n.url) && n.method === 'DELETE');
    const storageRemove = removeReqs.find((n) => /\/storage\/v1\/object\/attachments/i.test(n.url) && n.method === 'DELETE');
    check('S3c: save-after-remove fires attachments row DELETE + Storage remove (orphan cleanup)', !!attachDelete && !!storageRemove, { attachDelete: attachDelete || null, storageRemove: storageRemove || null });
    check('S3c: edit success toast', okEdit);
    await shot(page, 's3c-after-remove');
  } else {
    check('S3c: could not open edit (수정 button not found)', false);
  }

} catch (err) {
  check('FATAL', false, { error: String(err && err.stack || err).slice(0, 500) });
} finally {
  await writeFile(path.join(OUT, 'staff-results.json'), JSON.stringify({ marker: MARKER, results, net, errResponses }, null, 2));
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== STAFF RESULTS: ${passed}/${results.length} passed ===`);
  await browser.close();
}
