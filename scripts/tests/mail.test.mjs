import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractAuthLink } from '../../e2e/mail.mjs';
test('extracts token hash callback and decodes HTML attribute ampersands',()=>{
  assert.equal(extractAuthLink('<a href="http://localhost:8081/renvi/auth-callback?token_hash=abc&amp;type=signup">Подтвердить</a>','signup'),'http://localhost:8081/renvi/auth-callback?token_hash=abc&type=signup');
});
test('extracts recovery plain text and rejects unrelated links',()=>{
  assert.equal(extractAuthLink('http://localhost:8081/reset-password?token_hash=x&type=recovery','recovery'),'http://localhost:8081/reset-password?token_hash=x&type=recovery');
  assert.equal(extractAuthLink('<a href="https://host/privacy">Приватность</a>','signup'),null);
});
